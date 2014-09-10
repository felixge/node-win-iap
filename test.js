var fs = require('fs');
var path = require('path');
var Verifier = require('./index');
var receipt = fs.readFileSync(path.join(__dirname, 'test-receipt.xml'), 'utf-8');
var assert = require('assert');

var tests = {};
function test(name, fn) {
  tests[name] = false;
  fn()
    .finally(function() {
      tests[name] = true;
    })
    .done();
}

var v = new Verifier();

test('ok', function() {
  return v
    .verify(receipt)
    .then(function() {
      var start = Date.now();
      // cert should be cached on second fetch with same Verifier
      return v.verify(receipt).then(function() {
        return Date.now() - start;
      });
    })
    .then(function(duration) {
      // 100ms tolerance because the xpath engine seems to be slow, taking up to
      // 17ms on my machine : /
      assert.ok(duration < 100, 'duration='+duration);
    });
});

test('response object', function() {
  return v
    .verify(receipt)
    .then(function(response) {
      assert.ok("expiryTimeMillis" in response);
      assert.equal(response.expiryTimeMillis,1346627329000);
      assert.ok("startTimeMillis" in response);
      assert.equal(response.startTimeMillis,1346368132000);
    });
});


test('badSig', function() {
  return v
    .verify(receipt.replace('SjRIxS', 'FUBAR'))
    .catch(function(err) {
      assert.strictEqual(err.verifyErr, 'badsignature');
    });
});


test('badXML', function() {
  return v
    .verify(receipt+'<invalid<xml')
    .catch(function(err) {
      assert.strictEqual(err.verifyErr, 'badxml');
    });
});

test('badFetch', function() {
  return (new Verifier({certURL: 'http://nononono.nothing/'}))
    .verify(receipt)
    .catch(function(err) {
      assert.strictEqual(err.verifyErr, 'badcertfetch');
    });
});

process.on('exit', function() {
  for (var key in tests) {
    assert.equal(tests[key], true, 'test did not complete: '+key);
  }
  console.log('test passed');
});
