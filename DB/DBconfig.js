module.exports = {
    /*host: "iprocessi.db.12097505.b71.hostedresource.net",
    user: "iprocessi",
    password: "Processi1!",
    database: "iprocessi",
    */

    host     : 'aa1buqandulbapb.ckxxnoao70dp.us-east-1.rds.amazonaws.com',
    user     : 'iprocessi',
    password : 'processi1!',
    port     : '3306',
    database : 'iprocessi',
    
    pool:{ maxConnections: 50, maxIdleTime: 30},
    typeCast: function (field, next) {
          // handle only BIT(1)
          if (field.type == "BIT" && field.length == 1) {
              var bit = field.string();
  
              return (bit === null) ? null : bit.charCodeAt(0);
          }
  
          // handle everything else as default
          return next();
      }
  };