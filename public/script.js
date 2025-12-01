const socket = io();

const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {});
var myPeerID;
var admin = false;
var joinedParticipantID;
let myVideoStream;

const myVideo = document.createElement('video');
myVideo.muted = true; // Always mute local video

const peers = {};


$(document).ready(function() {
    
    // Function to append message to UI
    const addMessageToUI = (name, msg, time) => {
        $("ul.messages").append(
            `<li class="message">
                <b>${name}</b><br/>${msg}
                <div style='text-align: right; font-size: xx-small; color:grey; width:90%'>${time}</div>
            </li>`
        );
        scrollToBottom();
    };

    // Send Message Function
    const sendChatMessage = () => {
        let text = $("#chat_message");
        let msg = text.val();
        
        if (msg && msg.length !== 0) {
            // 1. Send to server
            socket.emit('message', msg);
            
            // 2. Show it immediately on my screen as "You"
            var date = new Date();
            let time = date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0');
            addMessageToUI("You", msg, time);

            text.val(''); // Clear input
        }
    };

    // Listeners
    $('#sendMsgBtn').click(sendChatMessage);
    $('html').keydown(function (e) {
        if (e.which == 13 && $("#chat_message").is(":focus")) {
            sendChatMessage();
        }
    });

    // Receive Messages from OTHERS
    socket.on("createMessage", (message, userName) => {
        
        
        if(userName !== user_name_google) { 
            var date = new Date();
            let time = date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0');
            addMessageToUI(userName, message, time);
        }
    });
});


navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    myPeer.on('call', call => {
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream);
        });
    });

    socket.on('user-connected', userId => {
        setTimeout(() => connectToNewUser(userId, stream), 1000);
    });

    socket.on('viewScreen', userId => {
        connectToNewUser(userId, stream);
    });
});


// Button Action: Show Participants
function ShowParticipants() {
    socket.emit('RoomDetailsRequest');
    
    // Create a new Bootstrap Modal instance for the element with ID 'exampleModal'
    var myModal = new bootstrap.Modal(document.getElementById('exampleModal'));
    myModal.show();
}

// Receive Participant List
socket.on('RoomDetailsResponse', (roomDetails) => {
    if (roomDetails && roomDetails[0].PeerID == myPeerID) {
        admin = true;
    }
    
    const listContainer = document.getElementById('ParticipantsListMain');
    listContainer.innerHTML = ''; // Clear list
    
    roomDetails.forEach((value) => {
        listContainer.innerHTML += `
        <div style="padding: 10px; border-bottom: 1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <span>${value.Name}</span>
            ${admin && value.PeerID !== myPeerID ? `
            <div>
                <i class="fas fa-minus-circle" style="cursor:pointer; color:red; margin-right:10px;" onclick="RemoveParticipant('${value.PeerID}')" title="Remove"></i>
                <i class="fas fa-microphone-slash" style="cursor:pointer; color:orange;" onclick="MuteParticipant('${value.PeerID}')" title="Mute"></i>
            </div>` : ''}
        </div>`;
    });
});


function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    video.id = userId;
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });
    call.on('close', () => {
        video.remove();
    });
    peers[userId] = call;
}

function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
}

const scrollToBottom = () => {
    var d = $('.main__chat_window');
    d.scrollTop(d.prop("scrollHeight"));
}

// --- Toggle Chat Box ---
function ShowChatBox() {
    document.querySelector('.main__right').style.display = 'flex';
    document.querySelector('.main__comment_button').classList.add('clr-yellow');
}

function RemoveChatBox() {
    document.querySelector('.main__right').style.display = 'none';
    document.querySelector('.main__comment_button').classList.remove('clr-yellow');
}

// --- Whiteboard Logic ---
var currentColor = 'black';
var currentLineWidth = 5;
var canvas = document.querySelector('#board');
var ctx = canvas.getContext('2d');

function board() {
    let wb = document.querySelector("#sketch");
    if (wb.style.display === "none") {
        wb.style.display = "block";
        document.querySelector("#video-grid").style.display = "none";
        document.querySelector("#wbShowHide").classList.add("bg-yellow");
        drawOnCanvas();
    } else {
        wb.style.display = "none";
        document.querySelector("#video-grid").style.display = "grid";
        document.querySelector("#wbShowHide").classList.remove("bg-yellow");
    }
}

function drawOnCanvas() {
    canvas.style.width ='100%';
    canvas.style.height='80%';
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    var mouse = {x: 0, y: 0};
    var last_mouse = {x: 0, y: 0};

    document.getElementById('clr').addEventListener('click', function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, false);

    canvas.addEventListener('mousemove', function(e) {
        last_mouse.x = mouse.x;
        last_mouse.y = mouse.y;
        mouse.x = e.pageX - this.offsetLeft;
        mouse.y = e.pageY - this.offsetTop;
    }, false);

    canvas.addEventListener('mousedown', function(e) {
        canvas.addEventListener('mousemove', onPaint, false);
    }, false);

    canvas.addEventListener('mouseup', function() {
        canvas.removeEventListener('mousemove', onPaint, false);
    }, false);

    var onPaint = function() {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(last_mouse.x, last_mouse.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.closePath();
        ctx.stroke();

        setTimeout(function(){
            var base64ImageData = canvas.toDataURL("image/png");
            socket.emit("canvas-data", base64ImageData);
        }, 500);
    };
}

function changeColor(color) {
    if(color === 'white') {
        currentColor = 'white';
        currentLineWidth = 15;
    } else {
        currentColor = color;
        currentLineWidth = 5;
    }
}

// --- Socket Essentials ---
socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close();
});

myPeer.on('open', id => {
    myPeerID = id;
    myVideo.id = id;
    socket.emit('join-room', ROOM_ID, id, user_name_google);
});

// Admin Mute/Remove
function MuteParticipant(peerID) { socket.emit("MuteOrder", (peerID)); }
socket.on("MuteParticipant", (peerID) => { if (peerID == myPeerID) muteUnmute(); })

function RemoveParticipant(peerID) { if (admin) socket.emit("RemoveOrder", (peerID)); }
socket.on("RemoveParticipant", (peerID) => { if (peerID == myPeerID) location.href='/endmeet'; })

function muteUnmute() {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        document.querySelector('.main__mute_button').innerHTML = `<i class="unmute fas fa-microphone-slash"></i>`;
        document.querySelector('.main__mute_button').classList.add('bg-yellow');
    } else {
        myVideoStream.getAudioTracks()[0].enabled = true;
        document.querySelector('.main__mute_button').innerHTML = `<i class="fas fa-microphone"></i>`;
        document.querySelector('.main__mute_button').classList.remove('bg-yellow');
    }
}

function playStop() {
    let enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        document.querySelector('.main__video_button').innerHTML = `<i class="stop fas fa-video-slash"></i>`;
        document.querySelector('.main__video_button').classList.add('bg-yellow');
    } else {
        myVideoStream.getVideoTracks()[0].enabled = true;
        document.querySelector('.main__video_button').innerHTML = `<i class="fas fa-video"></i>`;
        document.querySelector('.main__video_button').classList.remove('bg-yellow');
    }
}

// Time handler
function elapsedTimeIntervalRef (){ setInterval(() => {
    // Assuming 'timeAndDateHandling' exists in liveTime.js, otherwise simple fallback
    var date = new Date();
    document.getElementById("timest").innerHTML = date.getHours() + ":" + date.getMinutes();
}, 1000); }