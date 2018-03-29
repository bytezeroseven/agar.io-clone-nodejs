


var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static(__dirname + '/client'));

var port = process.env.PORT || 3000;
http.listen(port, function() {
  console.log("Server is listening on port " + port);
});






function Blob(server, nodeId, x, y, mass, parent) {
	this.server = server;
	this.nodeId = nodeId;
	this.nodeType = -1; // 0- playerBlob, 1- food, 2-eject, 3-virus
	
	this.x = x;
	this.y = y;
	this.mass = mass;
	this._mass = mass;

	this.nick = "";
	this.skinURL = "";
	
	this.parent = parent;
	this.hue = Math.random() * 360;
	this.boostEngine = {
		x: 0,
		y: 0,
		angle: 0
	};
};
Blob.prototype.getSpeed = function() {
	return 15 * 1.6 / Math.pow(this.mass, 0.32);
};
Blob.prototype.getBoostSpeed = function() {
	return 15 * 2.6 * Math.pow(this.mass, 0.0122);
};
Blob.prototype.getSize = function() {
	return Math.sqrt(this.mass) * 10;
};
Blob.prototype.setBoost = function(angle) {
	var speed = this.getBoostSpeed();
	this.boostEngine = {
		x: Math.cos(angle) * speed,
		y: Math.sin(angle) * speed,
		angle: angle
	};
};
Blob.prototype.getBoostAngle = function() {
	return this.boostEngine.angle;
};
Blob.prototype.boostMove = function() {
	this.x += this.boostEngine.x;
	this.y += this.boostEngine.y;
	this.boostEngine.x *= 0.95;
	this.boostEngine.y *= 0.95;
};
Blob.prototype.isBoosting = function() {
	return Math.hypot(this.boostEngine.x, this.boostEngine.y) > 10
};
Blob.prototype.borderCheck = function() {
	var xStart = 0;
	var xEnd = this.server.config.width;
	var yStart = 0;
	var yEnd = this.server.config.width;

	this.x = Math.min(xEnd, Math.max(this.x, xStart));
	this.y = Math.min(yEnd, Math.max(this.y, yStart));
};



// Hooks
Blob.prototype.onEat = function(prey) {
	this.mass += prey.mass;
};
Blob.prototype.onEaten = function(eater) {
	this.server.removeNode(this);
};
Blob.prototype.move = function() {
	// dddd
};
Blob.prototype.eat = function() {
	// dddd
};

function PlayerBlob() {
	Blob.apply(this, arguments);
	this.nodeType = 0;
};
PlayerBlob.prototype = new Blob();
PlayerBlob.prototype.move = function() {
	var mouse = this.parent.getMouse(this.x, this.y);
	var angle = mouse.angle;
	var vx = mouse.vx / (this.getSize() * 0.11);
	var vy = mouse.vy / (this.getSize() * 0.11);
	var speed = this.getSpeed();
	this.x += Math.cos(angle) * speed * Math.min(Math.pow(vx, 2), 1);
	this.y += Math.sin(angle) * speed * Math.min(Math.pow(vy, 2), 1);
};
PlayerBlob.prototype.eat = function() {
	var nodes = this.server.getNodesInRange(this.x, this.y);
	var selfParentId = this.parent.id;
	var ejectNodes = nodes.filter(function(a) {
		return a.nodeType == 0 ? a.parent.id != selfParentId : true;
	});

	for(var i = 0; i < ejectNodes.length; i++) {
		var check = ejectNodes[i];
		if(this.server.collisionHandler.canEat(this, check)) {
			this.onEat(check);
			check.onEaten(this);
		};
	};
};

function Virus() {
	Blob.apply(this, arguments);
	this.nodeType = 1;
};
Virus.prototype = new Blob();
Virus.prototype.onEat = function(prey) {
	this.mass += prey.mass;
	if(this.mass > this.server.config.virusMaxMass) {
		this.server.shootVirus(this, prey.getBoostAngle());
	}
};
Virus.prototype.eat = function() {
	var nodes = this.server.getNodesInRange(this.x, this.y);
	var ejectNodes = nodes.filter(function(a) {
		return a.nodeType == 3;
	});

	for(var i = 0; i < ejectNodes.length; i++) {
		var check = ejectNodes[i];
		if(this.server.collisionHandler.canEat(this, check)) {
			this.onEat(check);
			check.onEaten(this);
		};
	};
};
Virus.prototype.onEaten = function(eater) {
	Blob.prototype.onEaten.apply(this, arguments);

	this.server.addVirus(1);

	var numSplits = this.server.config.playerMaxSplit - eater.parent.blobs.length;
	var massLeft = eater.mass;

	if(numSplits <= 0) return;

	var massLeft = eater.mass;
	if (massLeft < 266) {
		var splitAmount = 1;
		while (massLeft > 0) {
    		splitAmount *= 2;
    		massLeft = eater.mass - splitAmount * 36;
		};
		var splitMass = eater.mass / splitAmount;
		for (var i = 0; i < Math.min(splitAmount, numSplits); i++) {
    		var angle = Math.random() * 6.28;
   		 	if (eater.mass <= 36) {
   		 		break;
   		 	}

   		 	this.server.createPlayerBlob(
				eater.x,
				eater.y,
				splitMass,
				angle,
				eater, eater.parent);
		};
	} else {
        var beginMass = eater.mass,
    		smallMass = 19,
  			splitMass = beginMass * 0.44 - smallMass * numSplits;	
        while (eater.mass > beginMass * 0.5 && splitMass > smallMass) {
            numSplits--;
            var angle = Math.random() * 6.28;
            this.server.createPlayerBlob(
				eater.x,
				eater.y,
				splitMass,
				angle,
				eater, eater.parent);
            splitMass *= 0.55;
        };
        for (var i = 0; i < numSplits; i++) {
            var angle = Math.random() * 6.28;
            this.server.createPlayerBlob(
				eater.x,
				eater.y,
				smallMass,
				angle,
				eater, eater.parent);
        };
    }
};



function Food() {
	Blob.apply(this, arguments);
	this.nodeType = 2;
};
Food.prototype = new Blob();
Food.prototype.onEaten = function() {
	Blob.prototype.onEaten.apply(this, arguments);
	this.server.addFood(1);
};

function Eject() {
	Blob.apply(this, arguments);
	this.nodeType = 3;
};
Eject.prototype = new Blob();





function Player(server) {
	this.id = Math.random();
	this.server = server;
	this.blobs = [];

	this.combine = false;

	this.drawZoom = 1;
	this.centerX = 0;
	this.centerY = 0;

	this._drawZoom = 1;
	this._centerX = 0;
	this._centerY = 0;

	this.rawMouseX = 0;
	this.rawMouseY = 0;
	this.screenWidth = 1920;
	this.screenHeight = 1080;
};
Player.prototype.onMouseMove = function(e) {
	this.rawMouseX = e.clientX;
	this.rawMouseY = e.clientY;
};

Player.prototype.onKeyDown = function(e) {
	var key = e.keyCode;

	if(key == 87) {
		var len = this.blobs.length;
		for(var i = 0; i < len; i++) {
			var blob = this.blobs[i];
			this.server.addEject(blob);
		};
	}
	if(key == 69) {
		this.combine = true;
	} 
	if(key == 32) {
		var len = this.blobs.length;
		for(var i = 0; i < len; i++) {
			var blob = this.blobs[i];
			this.server.splitPlayerBlob(blob);
		};
	}
};
Player.prototype.onKeyUp = function(e) {
	var key = e.keyCode;
	if(key == 69) {
		this.combine = false;
	} 
};
Player.prototype.getMouse = function(x, y) {
	var relX = (this.centerX - x) * this.drawZoom;
	var relY = (this.centerY - y) * this.drawZoom;
	var x = relX + this.rawMouseX - this.screenWidth / 2;
	var y = relY + this.rawMouseY - this.screenHeight / 2;
	return {
		angle: Math.atan2(y, x),
		vx: x,
		vy: y
	};
};

Player.prototype.updateCenter = function() {
	var totalX = 0, 
		totalY = 0, 
		totalSize = 0;

	var len = this.blobs.length;
	if(len == 0) {
		return;
	}

	for(var i = 0; i < len; i++) {
		var blob = this.blobs[i];

		totalX += blob.x;
		totalY += blob.y;
		totalSize += blob.getSize();
	};

	this.centerX = totalX / len;
	this.centerY = totalY / len;
	this.drawZoom = 1 / (Math.sqrt(totalSize) / Math.log(totalSize));

	this._centerX += (this.centerX - this._centerX) * 0.2;
	this._centerY += (this.centerY - this._centerY) * 0.2;
	this._drawZoom += (this.drawZoom - this._drawZoom) * 0.2;
};




function Server() {
	this.collisionHandler = new CollisionHandler();
	this.nodes = [];
	this.players = [];

	this.config = {
		virusMaxMass: 200,
		virusMass: 100,
		ejectMass: 10,
		foodMass: 5,

		playerStartMass: 1000,
		playerMinMassForSplit: 20,
		playerMinMassForEject: 20,
		playerMaxMass: 20000,
		playerMaxSplit: 16,
		rangeWidth: 5000,
		rangeHeight: 2500,

		width: 20000,
		height: 20000
	};
};
Server.prototype.createPlayer = function(id, nick, skinURL) {
	var player = new Player(this);


	// -=+++=---====
	player.id = id;
	// +++---=+++=0==


	var startBlob = this.createPlayerBlob(
		Math.random() * this.config.width,
		Math.random() * this.config.height,
		this.config.playerStartMass,
		0, null, player, skinURL, nick);

	this.players.push(player);
	return player;
};
Server.prototype.createPlayerBlob = function(x, y, mass, angle, parentBlob, parent, skinURL, nick) {
	var playerBlob = new PlayerBlob(this, parent.blobs.length, x, y, mass, parent);
	
	playerBlob.skinURL = skinURL || "";
	playerBlob.nick = nick || "";

	if(parentBlob) {
		playerBlob.hue = parentBlob.hue;
		parentBlob.mass -= mass;
		playerBlob.setBoost(angle);
		playerBlob.skinURL = parentBlob.skinURL;
		playerBlob.nick = parentBlob.nick;
	}

	parent.blobs.push(playerBlob);
	return playerBlob;
};
Server.prototype.splitPlayerBlob = function(blob) {
	var numSplit = this.config.playerMaxSplit - blob.parent.blobs.length;
	if(numSplit <= 0 || blob.mass < this.config.playerMinMassForSplit) {
		return false;
	}

	var angle = blob.parent.getMouse(blob.x, blob.y).angle;
	this.createPlayerBlob(
		blob.x,
		blob.y,
		blob.mass * 0.5,
		angle,
		blob, blob.parent);
};
Server.prototype.shootVirus = function(virus, angle) {
	var shoot = new Virus(
		this, 
		this.nodes.length, 
		virus.x, 
		virus.y, 
		this.config.virusMass);

	shoot.hue = virus.hue;
	virus.mass = this.config.virusMass;

	shoot.setBoost(angle);
	this.nodes.push(shoot);
};

Server.prototype.addFood = function(number) {
	for(var i = 0; i < number; i++) {
		var blob = new Food(
			this, 
			this.nodes.length,
			Math.random() * this.config.width,
			Math.random() * this.config.height,
			this.config.foodMass);
		this.nodes.push(blob);
	};
};
Server.prototype.addVirus = function(number) {
	for(var i = 0; i < number; i++) {
		var blob = new Virus(
			this, 
			this.nodes.length,
			Math.random() * this.config.width,
			Math.random() * this.config.height,
			this.config.virusMass);
		this.nodes.push(blob);
	};
};
Server.prototype.addEject = function(blob) {
	if(blob.mass < this.config.playerMinMassForEject)
		return;

	var space = 50;
	var angle = blob.parent.getMouse(blob.x, blob.y).angle;
	var radius = blob.getSize();
	var ejectBlob = new Eject(
		this, 
		this.nodes.length,
		blob.x + Math.cos(angle) * (radius + space),
		blob.y + Math.sin(angle) * (radius + space),
		this.config.ejectMass);
	
	blob.mass -= this.config.ejectMass;
	ejectBlob.hue = blob.hue;
	ejectBlob.setBoost(angle);
	this.nodes.push(ejectBlob);
};
Server.prototype.removeNode = function(node) {
	if(node.nodeType != 0) {
		this.nodes.splice(node.nodeId, 1);
		for(var i = 0; i < this.nodes.length; i++) {
			var nd = this.nodes[i];
			nd.nodeId = i;
		};
	} else {
		node.parent.blobs.splice(node.nodeId, 1);
		for(var i = 0; i < node.parent.blobs.length; i++) {
			var nd = node.parent.blobs[i];
			nd.nodeId = i;
		};
	}
};
Server.prototype.getNodesInRange = function(x, y) {
	var xStart = x - this.config.rangeWidth / 2;
	var xEnd = x + this.config.rangeWidth / 2;
	var yStart = y - this.config.rangeHeight / 2;
	var yEnd = y + this.config.rangeHeight / 2;

	var allNodes = this.nodes;
	for(var i = 0; i < this.players.length; i++) {
		var plyr = this.players[i];
		var nodes = plyr.blobs;
		allNodes = allNodes.concat(nodes);
	};

	return allNodes.filter(function(a) {
		return a.x > xStart && a.x < xEnd && a.y > yStart && a.y < yEnd;
	});
};


Server.prototype.update = function() {
	for(var i = 0; i < this.players.length; i++) {
		var player = this.players[i];
		player.updateCenter();

		for(var x = 0; x < player.blobs.length; x++) {
			var blob = player.blobs[x];

			///////////////
			blob._mass += (blob.mass - blob._mass) * 0.2;

			if(blob.mass >= this.config.playerMaxMass) {
				this.createPlayerBlob(
					blob.x, 
					blob.y,
					blob.mass / 2,
					Math.random() * 2 * Math.PI,
					blob, blob.parent);
			};

//////////////////////
			
			blob.borderCheck();
			blob.move();
			blob.boostMove();
			blob.eat();
		};

		for(var j = 0; j < player.blobs.length; j++) {
			for(var k = 0; k < player.blobs.length; k++) {
				var blobA = player.blobs[j];
				var blobB = player.blobs[k];

				if(k != j) {
					if(!player.combine) {
						this.collisionHandler.pushApart(blobA, blobB);
					} else {
						this.collisionHandler.combinePlayer(blobA, blobB);
					}
				}
			};
		};
	};

	for(var i = 0; i < this.nodes.length; i++) {
		var node = this.nodes[i];

/////////////
		node._mass += (node.mass - node._mass) * 0.2;
///////////////
		
		node.borderCheck();
		node.boostMove();
		node.eat();
		node.move();
	};
};







//
// -=-====------========--------==--
//		colllision hanfdler
// -======-=====----=====-----=====-==


function CollisionHandler() {
	this.eatMassFactor = 0.2;
	this.eatDistFactor = 1;
};
CollisionHandler.prototype.isOverlapping = function(blob, check) {
	if(!blob || !check) {
		return;
	}
	var x = check.x - blob.x;
	var y = check.y - blob.y;
	var distance = Math.hypot(x, y);

	var maxDistance = blob.getSize() + check.getSize();
	if(distance < maxDistance) {
		return {
			x: x,
			y: y, 
			distance: distance,
			maxDistance: maxDistance
		};
	} else 
		return false;
};
CollisionHandler.prototype.canEat = function(eater, check) {
	if(!eater || !check) {
		return;
	}
	var overlap = this.isOverlapping(eater, check);
	var maxDistance = Math.pow(eater.mass + check.mass, 0.498888) * 10;
	var minMass = this.eatMassFactor * check.mass + check.mass;
	if(overlap.distance < maxDistance && eater.mass > minMass) {
		return true;
	} else {
		return false;
	}
};
CollisionHandler.prototype.pushApart = function(blobA, blobB) {
	if(!blobA || !blobB) {
		return;
	}

	var refA, refB;
	if(blobA.mass > blobB.mass) {
		refA = blobA;
		refB = blobB;
	} else {
		refA = blobB;
		refB = blobA;
	}

	var overlap = this.isOverlapping(refB, refA);
	var isBoosting = blobA.isBoosting() || blobB.isBoosting();

	if(overlap && !isBoosting) {
		var vx = overlap.x / overlap.distance;
		var vy = overlap.y / overlap.distance;
		refB.x += (refA.x - vx * overlap.maxDistance - refB.x) * 0.2;
		refB.y += (refA.y - vy * overlap.maxDistance - refB.y) * 0.2;
	} else {
		return false;
	}
};
CollisionHandler.prototype.combinePlayer = function(blobA, blobB) {
	if(!blobA || !blobB) {
		return;
	}

	var overlap = this.isOverlapping(blobA, blobB);
	var maxDistance = Math.pow(blobA.mass + blobB.mass, 0.498888) * 10;
	var isBoosting = Math.hypot(blobA.boostEngine.x, blobA.boostEngine.y) > 10 || 
					Math.hypot(blobB.boostEngine.x, blobB.boostEngine.y) > 10;
	if(overlap.distance < maxDistance && !isBoosting) {
		if(blobA.mass > blobB.mass) {
			blobA.onEat(blobB);
			blobB.onEaten(blobA);
		} else {
			blobB.onEat(blobA);
			blobA.onEaten(blobB);
		}
	} else {
		return false;
	}
};






var server = new Server();
server.addFood(1000);
server.addVirus(20);


var sockets = {};


var init = [];
var update = [];


io.on("connection", function(socket) {
	sockets[socket.id] = socket;

	

	//var player = server.createPlayer(socket.id, "𐍃𐌄𐌗", "");
	var player = new Player(server);
	player.id = socket.id;
	server.players.push(player);



	socket.on("join game", function(d) {
		var b  = server.createPlayerBlob(
			Math.random() * server.config.width,
			Math.random() * server.config.height,
			server.config.playerStartMass,
			0, null, player, d.skinURL, d.nick);
	});

	socket.on("disconnect", function() {
		delete sockets[socket.id];
		var index = server.players.indexOf(player);
		if(index > -1) {
			server.players.splice(index, 1)
		}
	})



	console.log("connected");
	console.log("players: " + server.players.length);


	socket.on("width and height", function(d) {
		player.screenWidth = d.w;
		player.screenHeight = d.h;
	})

	socket.on("input mouse", function(data) {
		player.onMouseMove(data);
	});
	socket.on("input keyup", function(data) {
		player.onKeyUp(data);
	});
	socket.on("input keydown", function(data) {
		player.onKeyDown(data);
	});

	

});



setInterval(function() {
	
	server.update();

	for(var key in sockets) {
		var socket = sockets[key];
		var player = server.players.filter(function(p) {
			return p.id == socket.id
		})[0];


		var package = [];
	 	var blobs = server.getNodesInRange(player.centerX, player.centerY);

	 	for(var i in blobs) {
	 		var b = blobs[i];
	 		package.push({
	 			x: b.x, 
	 			y: b.y,
	 			skinURL: b.skinURL,
	 			nick: b.nick,
	 			size: Math.sqrt(b._mass) * 10,
	 			hue: b.hue
	 		});
	 	};



	 	socket.emit("update blobs", package);
		
	 	if(player.blobs.length == 0) {
	 		socket.emit("dead");
	 		continue;
	 	} else {
	 		socket.emit("joined");
	 	}

		var translateX = player._centerX * player._drawZoom - player.screenWidth / 2;
		var translateY = player._centerY * player._drawZoom - player.screenHeight / 2;

		
		socket.emit("center and zoom", {
			centerX: translateX,
			centerY: translateY,
			zoom: player._drawZoom
		});


	}
}, 1000/60);



