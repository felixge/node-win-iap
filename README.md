# win-iap

Verifies windows store (in app) [purchase receipts](http://msdn.microsoft.com/en-us/library/windows/apps/jj649137.aspx).

Based on [Validating Windows Mobile App Store Receipts Using Node.js](http://webservices20.blogspot.de/2013/06/validating-windows-mobile-app-store.html).

Developed for [ProSiebenSat.1 Digital GmbH](http://www.prosiebensat1digital.de/).

## Install

```js
npm install win-iap
```

## Usage

```js
var receipt = '<receiptXML/>';
var Verifier = require('win-iap');
var verifier = new Verifier();
verifier
  .verify(receipt)
  .then(function(response) {
    console.log('Valid receipt.');
    console.log('id: '+response.id);
    console.log('purchased: '+response.startTimeMillis);
    console.log('expires: '+response.expiryTimeMillis);
  })
  .catch(function(err) {
    console.log('Invalid receipt: ', err);
  });
```

## API

### `new Verifier(options)`

Options is an optional object with the following possible fields:

* `certURL`: The url to download certificates from. Defaults to `'https://go.microsoft.com/fwlink/?LinkId=246509&cid=#{ID}'`.
* `certCache`: An object with a `get(id)` and `set(id, val)` method for caching certificates. The methods may return promises for async operation. Defaults to `new Verifier.MemoryCache()`.

### `verifier.verify(receipt)`

Returns a promise for verifying the given receipt XML string. The promise will resolve if the receipt is valid, or raise an error if it is invalid or can't be verified for other reasons.

Errors will have a `verifyErr` property which can have the following values:

* `'badsignature'`: The signature did not match.
* `'badxml'`: The receipt XML was invalid.
* `'badfetch'`: The certificate could not be fetched.

## License

MIT License.
