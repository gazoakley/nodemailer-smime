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
    const message = new MimeNode('multipart/mixed');
    message.setHeader({
      from: 'Example user <user@example.com>',
      to: 'Example recipient <recipient@example.com>',
      subject: 'Example message',
    });
    const textNode = message.createChild('text/plain');
    textNode.setContent('Example\nmessage');
    const binaryNode = message.createChild('application/octet-stream');
    binaryNode.setContent('DO\nNOT\nALTER');
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

  it('should create a new root MIME node with children when a certificate chain is provided', (done) => {
    const plugin = smime({
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem'), 'binary'),
      key: fs.readFileSync(path.join(__dirname, 'key.pem'), 'binary'),
      chain: [
        fs.readFileSync(path.join(__dirname, 'caCert.pem'), 'binary'),
      ],
    });
    const message = new MimeNode('multipart/mixed');
    message.setHeader({
      from: 'Example user <user@example.com>',
      to: 'Example recipient <recipient@example.com>',
      subject: 'Example message',
    });
    const textNode = message.createChild('text/plain');
    textNode.setContent('Example\nmessage');
    const binaryNode = message.createChild('application/octet-stream');
    binaryNode.setContent('DO\nNOT\nALTER');
    const mail = { message };
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

  it('should return an errror when invalid content is provided', (done) => {
    const plugin = smime({
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem'), 'binary'),
      key: fs.readFileSync(path.join(__dirname, 'key.pem'), 'binary'),
      chain: [
        fs.readFileSync(path.join(__dirname, 'caCert.pem'), 'binary'),
      ],
    });
    const message = new MimeNode('multipart/mixed');
    message.setHeader({
      from: 'Example user <user@example.com>',
      to: 'Example recipient <recipient@example.com>',
      subject: 'Example message',
    });
    const textNode = message.createChild('application/octet-stream');
    textNode.setContent(9);
    const mail = { message };
    plugin(mail, (err) => {
      if (err) {
        return done();
      }
      done('error expected');
    });
  });

  it('should pull up headers from the original MIME node', () => {
    expect(mail.message.getHeader('From')).to.equal('Example user <user@example.com>');
    expect(mail.message.getHeader('to')).to.equal('Example recipient <recipient@example.com>');
    expect(mail.message.getHeader('subject')).to.equal('Example message');
  });

  it('should recreate the existing root MIME node as a child node', () => {
    expect(mail.message.childNodes[0].getHeader('Content-Type')).to.match(/multipart\/mixed/);
  });

  it('should not keep headers in the child node', () => {
    expect(mail.message.childNodes[0].getHeader('From')).to.be.undefined;
    expect(mail.message.childNodes[0].getHeader('to')).to.be.undefined;
    expect(mail.message.childNodes[0].getHeader('subject')).to.be.undefined;
  });

  it('should apply canonicalization to text/* nodes', () => {
    expect(mail.message.childNodes[0].childNodes[0].content).to.equal('Example\r\nmessage');
  });

  it('should not apply canonicalization to non text/* nodes', () => {
    expect(mail.message.childNodes[0].childNodes[1].content).to.equal('DO\nNOT\nALTER');
  });

  it('should create a signature', () => {
    expect(mail.message.childNodes[1].getHeader('Content-Type')).to.match(/application\/pkcs7-signature/);
  });
});
