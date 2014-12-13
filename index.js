/**
 *
 * Favicon Tester
 *
 * @author Michael Pearson <github@m.bip.io>
 * Copyright (c) 2010-2014 WoT.IO inc 2014-2015
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var request = require('request'),
  htmlparser = require('htmlparser2'),
  mime = require('mime'),
  tldtools = require('tldtools'),
  Q = require('q'),
  tldDefer = Q.defer();

tldtools.init(function() {
  tldDefer.resolve();
});

var favi = function(host, next) {
  var self = this,
    fileSuffix = '.ico',
    favUrlDefault = host + '/favicon' + fileSuffix;

  request(host, function(err, res, body) {
    var favUrl;

    if (err) {
      next(err);
    } else {
      if (res.headers.link && /rel=icon/.test(res.headers.link) ) {
        favUrl = res.headers.link.replace(/<|>.*$/g, '');
      }

      if (!favUrl) {
        var parser = new htmlparser.Parser({
          onopentag : function(name, attrs) {
            if ('link' === name) {
              if (attrs.href && /icon/i.test(attrs.rel)) {
                favUrl = (0 === attrs.href.indexOf('/') ? (host + attrs.href) : attrs.href);
              }
            }
          }
        });

        parser.write(body);
        parser.end();
      }

      if (!favUrl) {
        favUrl = favUrlDefault;
      }

      suffix = '.' + favUrl.split('.').pop().replace(/\?.*$/, '');

      request.head(favUrl, function(err, res) {
        if (err) {
          next(err);
        } else if (200 !== res.statusCode) {
          next('Not Found');
        } else {
          next(false, res.request.href);
        }
      });
    }
  });
};

var respond = function(err, favURL, URLTokens, next) {
  if (err) {
    next(err);
  } else {
    next(err, favURL, suffix, mime.lookup(favURL), URLTokens.domain + '.' + URLTokens.tld);
  }
}

module.exports = function(url, next) {
  tldDefer.promise.then(function() {
    var self = this,
      tokens = tldtools.extract(url),
      scheme = (/http(s?)/.test(tokens.url_tokens.protocol) ? tokens.url_tokens.protocol : 'http:') ,
      host = scheme + '//' + tokens.url_tokens.hostname,
      hostDomain = scheme + '//' + tokens.domain + '.' + tokens.tld;

    favi(host, function(err, favURL) {
      if (err) {
        // subdomain failed? fall back to domain name
        if (host !== hostDomain) {
          favi(hostDomain, function(err, favURL) {
            respond(err, favURL, tokens, next);
          });
        } else {
          next(err);
        }
      } else {
        respond(err, favURL, tokens, next);
      }
    });
  });
}
