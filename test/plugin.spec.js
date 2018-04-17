'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');
const MimeNode = require('nodemailer/lib/mime-node');

const smime = require('../src/plugin');

describe('smime', () => {
  let plugin;
  it('should return a plugin function', () => {
    plugin = smime({
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem'), 'binary'),
      key: fs.readFileSync(path.join(__dirname, 'key.pem'), 'binary'),
    });
    expect(plugin).to.be.a('function');
  });

  let mail;
  it('should create a new root MIME node with children', (done) => {
    const message = new MimeNode('text/plain');
    message.setContent('Example\nmessage');
    message.setHeader({
      from: 'Example user <user@example.com>',
      to: 'Example recipient <recipient@example.com>',
      subject: 'Example message',
    });
    mail = { message };
    plugin(mail, (err) => {
      if (err) {
        return done(err);
      }
      expect(mail.message.getHeader('Content-Type')).to.match(/multipart\/signed/);
      expect(mail.message.childNodes).to.be.an('array');
      expect(mail.message.childNodes).to.have.lengthOf(2);
      done();
    });
  });

  it('should pull up headers from the original MIME node', () => {
    expect(mail.message.getHeader('From')).to.equal('Example user <user@example.com>');
    expect(mail.message.getHeader('to')).to.equal('Example recipient <recipient@example.com>');
    expect(mail.message.getHeader('subject')).to.equal('Example message');
  });

  it('should recreate the existing root MIME node as a child node', () => {
    expect(mail.message.childNodes[0].getHeader('Content-Type')).to.match(/text\/plain/);
  });

  it('should not keep headers in the child node', () => {
    expect(mail.message.childNodes[0].getHeader('From')).to.be.undefined;
    expect(mail.message.childNodes[0].getHeader('to')).to.be.undefined;
    expect(mail.message.childNodes[0].getHeader('subject')).to.be.undefined;
  });

  it('should apply canonicalization to text/* nodes', () => {
    expect(mail.message.childNodes[0].content).to.equal('Example\r\nmessage');
  });

  it('should create a signature', () => {
    expect(mail.message.childNodes[1].getHeader('Content-Type')).to.match(/application\/pkcs7-signature/);
  });
});
