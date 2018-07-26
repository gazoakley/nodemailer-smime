'use strict';

const forge = require('node-forge');
const MimeNode = require('nodemailer/lib/mime-node');

const newline = /\r\n|\r|\n/g;
function canonicalTransform(node) {
  if (node.getHeader('content-type').slice(0, 5) === 'text/' && node.content) {
    node.content = node.content.replace(newline, '\r\n');
  }
  node.childNodes.forEach(canonicalTransform);
}

module.exports = function (options) {
  return function (mail, callback) {
    // Create new root node
    const rootNode = new MimeNode('multipart/signed; protocol="application/pkcs7-signature"; micalg=sha256;');

    // Append existing node
    const contentNode = rootNode.appendChild(mail.message);

    // Pull up existing headers (except Content-Type)
    const contentHeaders = contentNode._headers;
    for (let i = 0, len = contentHeaders.length; i < len; i++) {
      const header = contentHeaders[i];
      if (header.key.toLowerCase() === 'content-type') {
        continue;
      }
      rootNode.setHeader(header.key, header.value);
      contentHeaders.splice(i, 1);
      i--;
      len--;
    }

    // Need to crawl all child nodes and apply canonicalization to all text/* nodes
    // Otherwise mail agents may complain the message has been tampered with
    canonicalTransform(contentNode);

    // Build content node for digest generation
    contentNode.build((err, buf) => {
      if (err) {
        return callback(err);
      }

      // Generate PKCS7 ASN.1
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(buf.toString('binary'));
      p7.addCertificate(options.cert);
      (options.chain || []).forEach(cert => {
        p7.addCertificate(cert);
      });
      p7.addSigner({
        key: options.key,
        certificate: options.cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          {
            type: forge.pki.oids.contentType,
            value: forge.pki.oids.data,
          },
          {
            type: forge.pki.oids.messageDigest,
          },
          {
            type: forge.pki.oids.signingTime,
          },
        ],
      });
      p7.sign();
      const asn1 = p7.toAsn1();

      // Scrub encapContentInfo.eContent
      asn1.value[1].value[0].value[2].value.splice(1, 1);

      // Write PKCS7 ASN.1 as DER to buffer
      const der = forge.asn1.toDer(asn1);
      const derBuffer = Buffer.from(der.getBytes(), 'binary');

      // Append signature node
      const signatureNode = rootNode.createChild('application/pkcs7-signature', { filename: 'smime.p7s' });
      signatureNode.setContent(derBuffer);

      // Switch in and return new root node
      mail.message = rootNode;
      callback();
    });
  };
};
