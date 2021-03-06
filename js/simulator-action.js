var resetLine = 0;

function packetMover(delta) {
	// console.log(verticalMultiplier, senderStart, receiverStart);

	if (direction == SENDER && packets.x >= width - 20) {
		// Switch from Sender to Receiver

		direction *= -1;
		packets.x = -1 * rotatedPacketWidth - 2;

		var current = packets.y;
		packets = receiverPackets;
		packets.y = current - rotatedPacketHeight;

		numTransmissions++;

		sendReceiverPacket();

	} else if (direction == RECEIVER && packets.x < -1 * rotatedPacketWidth - 20) {
		// Switch from Receiver to Sender

		direction *= -1;
		packets.x = width + rotatedPacketWidth;

		var current = packets.y;
		packets = senderPackets;
		packets.y = current - 2 * rotatedPacketHeight;

		timeout.scale.x = 1;
		timeout.x = 0;

		numTransmissions++;

		sendSenderPacket();

	} else {

		var deltaX = speed * direction * delta;
		var deltaY = Math.abs(deltaX * verticalMultiplier);
		var deltaTimeout = delta * TIMEOUT_SPEED;

		if (flag == "PACKET_LOSS" && direction == SENDER
				&& packets.x >= width * .5 - rotatedPacketWidth/2 && numTransmissions == 2) {
			packetLoss();
			deltaX = 0;
			deltaY = 0;
		}

		else if (flag == "3_WAY_HANDSHAKE"
			&& numTransmissions == 3) {
			threeWay();
			deltaX = 0;
			deltaY = 0;
		}

		else if (flag == "ACK_LOSS"
			&& direction == RECEIVER
			&& packets.x <= width * .5
			&& numTransmissions == 1) {
			packetLoss();
			resetLine = 1;
			deltaX = 0;
			deltaY = 0;
		}

		else if (flag == "CONNECTION_CLOSE"
			&& numTransmissions == 2) {
			numTransmissions = 1;
			direction = RECEIVER;
			packets.y = height/2;
			resetLine = 30;
			deltaX = 0;
			deltaY = 0;
		}

		else if (flag == "CONNECTION_CLOSE"
			&& numTransmissions == 5) {
			close();
		}

		packets.x += deltaX;
		packets.y += deltaY;

		timeout.scale.x -= deltaTimeout;
		timeout.x += width * deltaTimeout/2; // Keeps rectangle centered while shrinking it

	}

	if (numTransmissions == 6) {
		stop();
		resetPackets();
		extraSeq = false;
		lessSeq = false;

	}

}

function updatePacket(newInfo) {
	var keys = Object.keys(newInfo);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		packet[key].innerHTML = newInfo[key];
	}
}

function sendInitialPacket() {
	updatePacket({ "SEQ": 42, "ACK": 79, "DATA": 'A' , "CWND": 10 });
	if (flag == "3_WAY_HANDSHAKE"
	   && numTransmissions == 0) {
		updatePacket({"SYN": 1});
	}
	else if (flag == "CONNECTION_CLOSE") {
		updatePacket({"FIN": 1});
	}
}

function sendSenderPacket() {
	var seq = Math.floor(numTransmissions/2)
	if (flag == "NORMAL_OPERATION"
	   && isEstablished == true) {
		updatePacket({"SYN": 0, "SEQ":42 + seq + 1, "ACK": 79 + seq, "DATA": String.fromCharCode('A'.charCodeAt(0) + seq + 1)});
		isEstablished = false;
		extraSeq = true;
	}
	else if (flag == "NORMAL_OPERATION"
		&& lessSeq == true) {
		updatePacket({"SYN": 0, "SEQ":42 + seq - 1, "ACK": 79 + seq - 1, "DATA": String.fromCharCode('A'.charCodeAt(0) + seq - 1)});
	}
	else if (flag == "CONNECTION_CLOSE"
		&& numTransmissions == 0) {
		updatePacket({ "FIN": 1, "SEQ":42 + seq, "ACK": 79 + seq, "DATA": String.fromCharCode('A'.charCodeAt(0) + seq) });
	}
	else if (flag == "CONNECTION_CLOSE"
		&& numTransmissions == 4) {
		updatePacket({ "FIN": 1, "SEQ":42 + seq - 1, "ACK": 79 + seq, "DATA": String.fromCharCode('A'.charCodeAt(0) + seq - 1) });
	}
	else if (extraSeq == true) {
		updatePacket({ "SEQ":42 + seq + 1, "ACK": 79 + seq, "DATA": String.fromCharCode('A'.charCodeAt(0) + seq + 1) } );
	}
	else {
		updatePacket({ "SEQ":42 + seq, "ACK": 79 + seq, "DATA": String.fromCharCode('A'.charCodeAt(0) + seq) });
	}
}

function sendReceiverPacket() {
	var seq = Math.floor(numTransmissions/2)
	if (flag == "NORMAL_OPERATION"
	    && lessSeq == true) {
		updatePacket({"SYN": 0, "SEQ":79 + seq - 1, "ACK": 42 + seq, "DATA": String.fromCharCode('Z'.charCodeAt(0) - seq + 1)});
	}
	else {
		updatePacket({ "SEQ": 79 + seq, "ACK": 42 + seq + 1, "DATA": String.fromCharCode('Z'.charCodeAt(0) - seq) });
	}
}

// TODO do this better!
function packetLoss() {
	if (packets.alpha != 0) {
		packets.alpha -= .1;
	}

	if (timeout.scale.x <= 0) {
		timeout.scale.x = 1;
		timeout.x = 0;

		packets.x = -1 * rotatedPacketWidth - 2;
		packets.y = height/3;
		packets.alpha = 1;
		flag = "NORMAL_OPERATION";
		var retransmit = document.getElementById("retransmit");
		var re = document.createElement('H3');
		re.innerHTML = 'Retransmitting';
		retransmit.appendChild(re);
		if (direction != SENDER) {
			lessSeq = true;
		}
	}

}

function ackLoss() {
	if (packets.alpha != 0) {
		packets.alpha -= .1;
	}
	if (timeout.scale.x <= 0) {
		timeout.scale.x = 1;
		timeout.x = 0;

		packets.x = -1 * rotatedPacketWidth - 2;
		packets.y = height/3;
		packets.alpha = 1;
		flag = "NORMAL_OPERATION";
		numTransmissions = 1;
		var retransmit = document.getElementById("retransmit");
		var re = document.createElement('H3');
		re.innerHTML = 'Retransmitting';
		retransmit.appendChild(re);
	}

}

var offset = 0;
var START_X = 0;
var START_Y = 0;

// Track Packet Movement
function dashedLine(delta) {
	var container = new PIXI.Container();
	var graphics = new PIXI.Graphics();

	graphics.lineStyle(0.2, 0xffffff);

	// Occurs after ACK or Packet loss flag is indicated
	if (resetLine > 0){
		resetLine--;
	}

	else if (offset % 20 == 0 && resetLine == 0){
		graphics.moveTo(START_X, START_Y);
		graphics.lineTo(packets.x, packets.y);

	}
	START_X = packets.x;
	START_Y = packets.y;

	offset += 5;
	app.stage.addChild(graphics);

}

function threeWay() {
	timeout.scale.x = 1;
	timeout.x = 0;

	if (packets.alpha != 0) {
		packets.alpha -= .1;
	}
	//alert("Connection Established!");
	var established = document.getElementById("established");
	var estab = document.createElement('H3');
	estab.innerHTML = 'Connection Established';
	established.appendChild(estab);
	stop();
	/*
	isEstablished = true;
	packets.x = -1 * rotatedPacketWidth - 2;
	packets.y = height/2;
	packets.alpha = 1;
	flag = "NORMAL_OPERATION";
	numTransmissions = 2;
	*/
}

function close() {
	timeout.scale.x = 1;
	timeout.x = 0;
	
	stop();
	resetPackets();
	var established = document.getElementById("established");
	var estab = document.createElement('H3');
	estab.innerHTML = 'Connection Closed';
	established.appendChild(estab);
}
