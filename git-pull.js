var writable = require('./writable.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('./pkt-line.js').deframer);
var bops = require('bops');
var frameHead = require('./pkt-line.js').frameHead;

module.exports = gitPull;

function gitPull(socket, db, options) {
  var state;
  var streams = demux(deframer(socket), ["line", "pack", "error", "progress"]);
  var line = streams.line;
  var pack = streams.pack;
  var write = writable(socket.abort);
  write.error = streams.error;
  write.progress = streams.progress;

  var message = bops.from("git-upload-pack " + options.pathname + "\0host=" + options.hostname + "\0");
  write(frameHead(message.length), message);

  onNext($refs);

  return write;

  function onNext(nextState) {
    state = nextState;
    line.read(onRead);
  }

  function onRead(err, item) {
    if (err) return write.error(err);
    console.log(state.name, item);
    state(item, onNext);
  }

  function $refs(item, next) {
    throw new Error("TODO: Implement $refs");
  }

}

function pullMachine(write, db, options) {

}


function demux(stream, channels) {
  var queues = {};
  var emits = {};
  var streams = {};
  var reading = false;

  channels.forEach(function (name) {
    var queue = queues[name] = [];
    emits[name] = null;
    streams[name] = { read: demuxRead, abort: stream.abort };

    function demuxRead(callback) {
      if (queue.length) {
        return callback.apply(null, queue.shift());
      }
      if (emits[name]) return callback(new Error("Only one read at a time"));
      emits[name] = callback;
      check(name);
    }

  });

  return streams;

  function check(name) {
    var queue = queues[name];
    var emit = emits[name];
    if (emit && queue.length) {
      emits[name] = null;
      emit.apply(null, queue.shift());
    }

    if (reading) return;

    // If anyone is waiting on data, we should get more from upstream.
    var isWaiting = false;
    for (var i = 0, l = channels.length; i < l; i++) {
      if (emits[channels[i]]) {
        isWaiting = true;
        break;
      }
    }
    if (!isWaiting) return;

    reading = true;
    stream.read(onRead);
  }

  function onRead(err, item) {
    reading = false;
    if (item === undefined) {
      return channels.forEach(function (name) {
        queues[name].push([err]);
        check(name);
      });
    }
    var name = item[0];
    item = item[1];
    queues[name].push([null, item]);
    check(item);
  }

}

