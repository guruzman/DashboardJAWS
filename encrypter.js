var bcrypt = require('bcryptjs');
const saltRounds = 10;

module.exports.encrypt = function(data, callback){
	bcrypt.genSalt(saltRounds, function(err, salt){
		if(err) console.log(err);
		else{
			bcrypt.hash(data.toString(), salt, function(err, hash){
				if(err) console.log(err);
				else callback(hash);
			});
		}
	})
}

module.exports.checkHash = function(data, hash, callback, functionOnError){
	bcrypt.compare(data, hash, function(err,res){
		if(err) functionOnError();
		else {
			console.log(res);
			if(res === true) callback(res);
			else functionOnError();
		}
	});
}