var writable = require('./writable.js');
var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('./pkt-line.js').deframer);
var bops = require('bops');
var frameHead = require('./pkt-line.js').frameHead;
var demux = require('./demux.js');
var inspect = require('util').inspect;
var each = require('simple-stream-helpers/each.js');

module.exports = gitPull;

function gitPull(socket, db, options) {
  var state;
  var streams = demux(deframer(socket), ["line", "pack", "error", "progress"]);
  var line = streams.line;
  var pack = streams.pack;
  var write = writable(socket.abort);
  write.errorStream = streams.error;
  write.progress = streams.progress;

  send("git-upload-pack " + options.pathname + "\0host=" + options.hostname + "\0");

  onNext(null, $caps);

  var caps;
  var wants = [];

  each(pack, function (line) {
    console.error("pack", inspect(line));
  })(console.log);


  return write;

  function readRef(path, callback) {
    db.read(path, function (err, result) {
      if (err) return callback(err);
      if (result.substr(0, 5) === "ref: ") {
        return readRef(result.substr(5).trim(), callback);
      }
      callback(null, result);
    });
  }

  function writeRef(path, hash, callback) {
    if (path === "HEAD") {
      return db.read(path, function (err, result) {
        if (err) return callback(err);
        if (result.substr(0, 5) === "ref: ") {
          return writeRef(result.substr(5).trim(), hash, callback);
        }
        callback(new Error("HEAD should be symbolic ref"));
      });
    }
    if (wants.indexOf(hash) < 0) wants.push(hash);
    db.write(path, hash, callback);
  }

  function send(message) {
    if (message === null) {
      return write(bops.from("0000"));
    }
    var buf = bops.from(message);
    write(frameHead(buf.length + 4), buf);
  }

  function onNext(err, nextState) {
    if (err) return write.error(err);
    state = nextState;
    line.read(onRead);
  }

  function onRead(err, item) {
    if (err) return write.error(err);
    console.log(state.name, inspect(item, {colors:true}));
    state(item, onNext);
  }

  function $caps(item, next) {
    var index = item.indexOf("\0");
    if (index < 0) return next(new Error("Invalid ref line: " + JSON.stringify(item)));
    caps = parseCaps(item.substr(index + 1).trim());
    console.log("CAPS", inspect(caps, {colors:true}));
    $refs(item.substr(0, index), next);
  }

  function $refs(item, next) {
    if (item === null) {
      return $wants(item, next);
    }
    var index = item.indexOf(" ");
    if (index !== 40) return next(new Error("Invalid ref line: " + JSON.stringify(item)));
    var hash = item.substr(0, 40);
    var path = item.substr(41).trim();
    writeRef(path, hash, function (err) {
      next(err, $refs);
    });
  }

  function $wants(item, next) {
    send("want " + wants.shift() + " multi_ack_detailed side-band-64k thin-pack ofs-delta agent=jsgit\n");
    while (wants.length) {
      send("want " + wants.shift() + "\n");
    }
    send(null);
    send("done");
    next(null, $nak);
  }
  
  function $nak(item, next) {
    if (item.trim() !== "NAK") return next(new Error("Expected NAK"));
    next(null, $dump);
  }
  
  function $dump(item, next) {
    next(null, $dump);
  }

}

function parseCaps(string) {
  var caps = {};
  string.split(" ").forEach(function (part) {
    var parts = part.split("=");
    caps[parts[0]] = parts[1] || true;
  });
  return caps;
}