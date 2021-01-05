/* ympd
   (c) 2013-2014 Andrew Karpow <andy@ndyk.de>
   This project's homepage is: https://www.ympd.org

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License along
   with this program; if not, write to the Free Software Foundation, Inc.,
   Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

var socket;
var last_state;

var app = $.sammy(function() {

   function runBrowse() {

        $('#stations').removeClass('hide').find("tr:gt(0)").remove();
        socket.send('MPD_API_GET_QUEUE,0');

        $('#panel-heading').text("Station");
        $('#queue').addClass('active');
    }

    this.get(/\#\/(\d+)/, function() {
        runBrowse();
    });

});

$(document).ready(function(){
    webSocketConnect();
    $("#volumeslider").slider(0);
    $("#volumeslider").on('slider.newValue', function(evt,data){
        socket.send("MPD_API_SET_VOLUME,"+data.val);
    });
});

function webSocketConnect() {
    if (typeof MozWebSocket != "undefined") {
        socket = new MozWebSocket(get_appropriate_ws_url());
    } else {
        socket = new WebSocket(get_appropriate_ws_url());
    }

    try {
        socket.onopen = function() {
            console.log("connected");
            app.run();
            /* emit initial request */
            socket.send('MPD_API_GET_QUEUE,0');
        }

        socket.onmessage = function got_packet(msg) {
            if(msg.data === last_state || msg.data.length == 0)
                return;

            var obj = JSON.parse(msg.data);

            switch (obj.type) {
                case 'queue':
                    $('#stations > tbody').empty();
                    for (var song in obj.data) {
                        $('#stations > tbody').append(
                            "<tr trackid=\"" + obj.data[song].id + "\"><td>" + (obj.data[song].pos + 1) + "</td>" +
                                "<td>" + "<span>" + obj.data[song].name  + "</span></td>" +
                                "</tr>");
                    }

                    $('#stations > tbody > tr').on({
                        click: function() {
                            $('#stations > tbody > tr').removeClass('active');
                            socket.send('MPD_API_PLAY_TRACK,'+$(this).attr('trackid'));
                            $(this).addClass('active');
                        },
                    });
                    break;
                case 'state':
                    updatePlayIcon(obj.data.state);
                    updateVolumeIcon(obj.data.volume);

                    if(JSON.stringify(obj) === JSON.stringify(last_state))
                        break;

                    $('#volumeslider').slider(obj.data.volume);

                    $('#stations > tbody > tr').removeClass('active').css("font-weight", "");
                    $('#stations > tbody > tr[trackid='+obj.data.currentsongid+']').addClass('active').css("font-weight", "bold");

                    last_state = obj;
                    break;
                case 'update_queue':
                    socket.send('MPD_API_GET_QUEUE,0');
                    break;
                case 'song_change':
                    $('#currentstation').text(" " + obj.data.name);
                    $('#playing').text(" " + obj.data.title);
                    break;
                default:
                    break;
            }
        }

        socket.onclose = function(){
            console.log("disconnected");
            $('#brand').text("PI radio - backend not running");
            $('#volume').addClass('hide')
            $('#onoff').addClass('hide')
            $('#main-panel').addClass('hide')
        }

    } catch(exception) {
        alert('<p>Error' + exception);
    }

}

function get_appropriate_ws_url()
{
    var pcol;
    var u = document.URL;
    var separator;

    /*
    /* We open the websocket encrypted if this page came on an
    /* https:// url itself, otherwise unencrypted
    /*/

    if (u.substring(0, 5) == "https") {
        pcol = "wss://";
        u = u.substr(8);
    } else {
        pcol = "ws://";
        if (u.substring(0, 4) == "http")
            u = u.substr(7);
    }

    u = u.split('#');

    if (/\/$/.test(u[0])) {
        separator = "";
    } else {
        separator = "/";
    }

    return pcol + u[0] + separator + "ws";
}

var updateVolumeIcon = function(volume)
{
    $("#volume-icon").removeClass("glyphicon-volume-off");
    $("#volume-icon").removeClass("glyphicon-volume-up");
    $("#volume-icon").removeClass("glyphicon-volume-down");

    if(volume == 0) {
        $("#volume-icon").addClass("glyphicon-volume-off");
    } else if (volume < 50) {
        $("#volume-icon").addClass("glyphicon-volume-down");
    } else {
        $("#volume-icon").addClass("glyphicon-volume-up");
    }
}

var updatePlayIcon = function(state)
{
    if(state == 1) { // stop
        $('#onoff-icon').removeClass('green');
        $('#onoff-icon').addClass('red');
        $('#volume').addClass('hide')
        $('#main-panel').addClass('hide')
    } else { // play
        $('#onoff-icon').removeClass('red');
        $('#onoff-icon').addClass('green');
        $('#volume').removeClass('hide')
        $('#main-panel').removeClass('hide')
    }
}

function clickOnOff() {
    if($('#onoff-icon').hasClass('red')) {
        socket.send('MPD_API_SET_PLAY');
    } else {
        socket.send('MPD_API_SET_STOP');
    }
}
