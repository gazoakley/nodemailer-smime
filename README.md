# Nodemailer plugin to sign mail using S/MIME

This plugin signs mail using an S/MIME certificate. Many mail agents are able to decode these in order to prove the identity of the sender.

## Install

Install from npm

    npm install nodemailer-smime --save

## Usage

Load the `nodemailer-smime` plugin

```javascript
const smime = require('nodemailer-smime');
```

Attach it as a 'stream' handler for a nodemailer transport object

```javascript
transporter.use('stream', htmlToText(options));
```

## Options

  * `cert` - PEM formatted SMIME certificate to sign/bundle mail with
  * `key` - PEM formatted private key associated with certificate

## Example

```javascript
const nodemailer = require('nodemailer');
const smime = require('nodemailer-smime');
const transporter = nodemailer.createTransport();
const options = {
    cert: '<PEM formatted cert>',
    key: '<PEM formatted key>'
}
transporter.use('stream', smime(options));
transporter.sendMail({
    from: 'me@example.com',
    to: 'receiver@example.com',
    html: '<b>Hello world!</b>'
});
```

## License

**MIT**