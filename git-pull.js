var bops = require('bops');
var each = require('simple-stream-helpers/each.js');
var frameHead = require('./pkt-line.js').frameHead;
var writable = require('./writable.js');

module.exports = gitPull;

function gitPull(socket, db, options) {
  var write = writable(socket.abort);
  
  dump(socket);

  var message = bops.from("git-upload-pack " + options.pathname + "\0host=" + options.hostname + "\0");
  write(frameHead(message.length), message);

  return write;
}





function dump(socket) {
  each(socket, function (input) {
    console.log(input.toString());
  })(function (err) {
    if (err) throw err;
    console.log("DONE");
  });
}