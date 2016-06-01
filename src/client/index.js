var $          = require('jquery');
var NodeRSA    = require('node-rsa');
var CryptoJS   = require('crypto-js');
var superagent = require('superagent');

var $focus = $('#focus');
var $body  = $('#body');

var key = null;
var etat = null;
var decryptedLetters = [];

var decryptMessage = function( msg ) {
    var resultat = "Failed to decrypt";
    try {
        resultat = key.decrypt(msg, 'utf8');
    } catch (e) {
        console.warn("Problem: " + e);
    }
    return resultat;
}

var populateDecryptedLetters = function() {
    myPublicKey = key.exportKey('public');
    decryptedLetters = [];
    etat.letters.forEach( function( letter ) {
        if (letter.to == myPublicKey) {
            decryptedLetters.push( {
                date: letter.date,
                msg: decryptMessage(letter.msg)
            });
        }
    });
};
var reload = function( cb ) {
    if (! cb )
        cb = function(){};
    superagent
        .get("/etat")
        .send()
        .end( function(err, res) {
            if (err) return cb(err);
            etat = res.body;
            cb(null);
        });
}
// ajouter un nouveau nom et essailler de prevenir le champs vide .
var addAddress = function(name, pem) {
    // var pem = prompt("Public key");
    var name = prompt("Name");
    var ipadress= prompt("ipadress");
    try {
        if(name == "")  throw "empty";

      }
    catch(err) {
        alert( "Input is " + err);
        name = prompt("Name");

      }
    if (! pem ) {
        var randomKey = new NodeRSA({b: 512});
        pem = randomKey.exportKey('public');
    }
    etat.yp[pem] = {name: name, pem: pem, ipadress: ipadress};
    superagent
        .post("/addAddress")
        .send({pem:pem, name:name, ipadress: ipadress })
        .end(console.log.bind(console));
};

var newMessage = function(text, address) {
    var pubKey = new NodeRSA(address);
    var msg = {date:new Date(), to: address, msg: pubKey.encrypt(text,'base64')};
    console.log(JSON.stringify(msg, null, 2));
    superagent
        .post("/postMessage")
        .send(msg)
        .end(console.log.bind(console));
}


var $but1 = $('<button>').append("Inbox");
$("#header").append($but1 ).append($("<hr><br>"));
$but1.click(function(){
        var $list = $('<ul>');
        decryptedLetters.forEach( function(letter) {
            $list.append($('<li>').append(
                $('<a href="#">').append("Date: "+letter.date).click(function(){
                    $("#tableau").empty().append($("<h5>").text(JSON.stringify("DATE : "+letter.date+ ("/////")+"    MESSAGE : "+ letter.msg)).append("<br>"));
                }))
            );
        });

        var $reload = $('<button>').append("")
            .click(function(){ reload( function() {  populateDecryptedLetters();
              redraw_view();
            });
             });
        $content =  [$list, $reload];
        $("#tableau").empty().append($content);

});


var $but2 = $('<button>').append("Write");
$("#header").append($but2).append($("<hr><br>"));
$but2.click(function(){
        var $textarea = $('<textarea>');
        var $addresses = Object.keys(etat.yp).map( function( addr ) {
          return $('<option value="'+addr+'">').append(etat.yp[addr].name);
        });
        var $to = $('<select>').append( $addresses );
        var $newMessage = $('<button>').append("New Message")
            .click(function(){
                newMessage($textarea.val(), $to.val());
                $textarea.val("");
                reload( populateDecryptedLetters );
            });
        $contentwrite = [ " ",$('<br>') ,$to,$('<br>') , $textarea,$('<br>') , $newMessage ];
        $("#tableau").empty().append($contentwrite);
      });
  var $but3 = $('<button>').append("Adress Book");
    $("#header").append($but3);
      $but3.click(function(){
        var $list = $('<ul>');
        Object.keys(etat.yp).forEach( function(pem) {
            var entry = etat.yp[pem];
            $list.append($('<li>').append(
                $('<a href="#">').append(entry.name).click(function(){
                    $("#tableau").empty().append($("<h8>").text(JSON.stringify("NOM :" +entry.name+ ("////")+"    Adresse physique :"+entry.ipadress)));
                }))
            );
        });
        var $newAddress = $('<button>').append("New Address")
            .click(function(){ addAddress(name + Object.keys(etat.yp).length); redraw_view(); });
        $content =  ["Address book...", $list, $newAddress ];
      $("#tableau").empty().append($content);
    });




reload( function(err) {
    if (err) return console.error(err);
    if (! etat.encryptedKey) {
        // we do not have our key yet
        key = new NodeRSA({b: 512});
        password = prompt("New password");
        etat.encryptedKey = CryptoJS.AES.encrypt(key.exportKey(), password)
            .toString();
        superagent
            .post("/storeEncryptedKey")
            .send({encryptedKey: etat.encryptedKey})
            .end(console.log.bind(console));
        // add my public key to the yp
        addAddress((name || "me"), key.exportKey('public'));
    } else while (true) {
        var pem = null;
        try {
            password = prompt("Password check:");
            pem = CryptoJS.AES.decrypt(etat.encryptedKey, password)
                .toString(CryptoJS.enc.Utf8);
            key = new NodeRSA(pem);
            break;
        } catch (e) {
            alert("Try again...");
        }
    }

    // build decrypted list of messages
    populateDecryptedLetters();
    redraw_view();
});
