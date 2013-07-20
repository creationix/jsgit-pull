var bops = require('bops');

exports.frameHead = frameHead;
function frameHead(length) {
  var buffer = bops.create(4);
  buffer[0] = toHexChar(length >>> 12);
  buffer[1] = toHexChar((length >>> 8) & 0xf);
  buffer[2] = toHexChar((length >>> 4) & 0xf);
  buffer[3] = toHexChar(length & 0xf);
  return buffer;
}

function toHexChar(val) {
  return val < 0x0a ? val + 0x30 : val + 0x57;
}
