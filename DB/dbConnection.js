var mysql = require('mysql');
var config = require('./DBconfig.js');

var connection = mysql.createConnection(config);

function connect(cb){
  connection = mysql.createConnection(config);
  cb(connection);
}

function createConnection(pConnection){
  pConnection.connect(function(error){
    if(error){
      console.log("Error connecting to DB");
      setTimeout(function(){
        closeConnection();
        connect(createConnection);
      }, 1000);
    }
  });
  pConnection.on('error',function(error){
    console.log("Db error " + error.code);
    if(error.code === 'PROTOCOL_CONNECTION_LOST');
    {
      closeConnection(connect);
      connect(createConnection);
    }
  });
  console.log("Connected!");
}

var closeConnection = function(connect, create){
  connection.destroy();
  //connect(createConnection);
}

var executeQuery = function(sql, functionOnSuccess, data, functionParamCallBack, resPost){
  connection.query(sql, function(err, result){
    if(err){
      console.log(err)
      if(resPost !== undefined)resPost.status(400);
    } 
    else{
      if(functionOnSuccess !== undefined) functionOnSuccess(result, data,functionParamCallBack, resPost);
      else return result;
    }
  });
}

//connect(createConnection);

setInterval(()=>{
  connection.ping();
}, 1000);

function handleDisconnect(myconnection) {
  myconnection.on('error', function(err) {
    console.log(err)
    console.log('Re-connecting lost connection');
    connection.destroy();
    setTimeout(() => {
      connection = mysql.createConnection(config);
    handleDisconnect(connection);
    connection.connect();  
    }, 1000);
  });
}

handleDisconnect(connection);

module.exports = connection;