const dbConnection = require('../DB/dbConnection.js');

module.exports.insertDebt = function(cedula, id_entidad_recaudo, id_entidad_adquiriente, id_entidad_autorizadora, id_cajero, valor_tx, num_factura, resultado_transaccion,resPost, done){
    var factura = (num_factura === undefined ? "NULL": num_factura);
    var d = new Date,
    	dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
            d.getDate().padLeft(),
            ].join('-') +' ' +
            [d.getHours().padLeft(),
            d.getMinutes().padLeft(),
            d.getSeconds().padLeft()].join(':'),
        dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
            d.getDate().padLeft(),
            ].join('-');
    var diaSep = ("00" + d.getDate()).split('');
    var dia = diaSep[diaSep.length-2] + '' + diaSep[diaSep.length-1];
    var horaSep = ("00" + d.getHours()).split('');
    var hora = horaSep[horaSep.length-2] + '' + horaSep[horaSep.length-1];
    var minSep = ("00" + d.getMinutes()).split('');
    var min = minSep[minSep.length-2] + '' + minSep[minSep.length-1];
    var secSep = ("00" + d.getSeconds()).split('');
    var sec = secSep[secSep.length-2] + '' + secSep[secSep.length-1];
	var mesSep = ("00" + (d.getMonth()+1)).split('');
	var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
    var secuencia =[dia,hora, min, sec].join('');
    var sql = "INSERT INTO `movimiento_" + d.getFullYear() + mes + "` VALUES(NULL, '" + dformatHour + "', NULL, '" + dformat + "', NULL, NULL, NULL, NULL, '" + secuencia + "', NULL, " + valor_tx +", 0, 0, 0, 0, NULL, NULL, NULL, NULL, " + id_entidad_recaudo + ", '" + cedula + "', '" + factura + "', NULL, NULL, '" + id_cajero + "', " + id_entidad_adquiriente + ", " + id_entidad_autorizadora + ", " + id_entidad_adquiriente + ", " + id_entidad_adquiriente + ", " + id_entidad_autorizadora +", " + id_entidad_autorizadora + ", 760, " + resultado_transaccion + ", NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '1000', 0, 0, 0, NULL, NULL, NULL);";
    dbConnection.query(sql, function(err, result){
        if(err){
            console.log(err)
            resPost.status(200).json({
                status:'error',
                code:"999",
                msg:'Error inserting transaction in DB',
            })
        }
        else{
            done();
        }
    });
}

module.exports.insertCollect = function(cedula, id_entidad_recaudo, id_entidad_adquiriente, id_entidad_autorizadora, id_cajero, valor_tx, num_factura, resultado_transaccion, billetesIn, coinsIn, resPost,done){
    var factura = (num_factura === undefined ? "NULL": num_factura);
    var d = new Date,
        dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
            d.getDate().padLeft(),
            ].join('-') +' ' +
            [d.getHours().padLeft(),
            d.getMinutes().padLeft(),
            d.getSeconds().padLeft()].join(':'),
        dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
            d.getDate().padLeft(),
            ].join('-');
    var diaSep = ("00" + d.getDate()).split('');
    var dia = diaSep[diaSep.length-2] + '' + diaSep[diaSep.length-1];
    var horaSep = ("00" + d.getHours()).split('');
    var hora = horaSep[horaSep.length-2] + '' + horaSep[horaSep.length-1];
    var minSep = ("00" + d.getMinutes()).split('');
    var min = minSep[minSep.length-2] + '' + minSep[minSep.length-1];
    var secSep = ("00" + d.getSeconds()).split('');
    var sec = secSep[secSep.length-2] + '' + secSep[secSep.length-1];
    var mesSep = ("00" + (d.getMonth()+1)).split('');
    var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
    var secuencia =[dia,hora, min, sec].join('');
    var sql = "INSERT INTO `movimiento_" + d.getFullYear() + mes + "` VALUES(NULL, '" + dformatHour + "', NULL, '" + dformat + "', NULL, NULL, NULL, NULL, '" + secuencia + "', NULL, " + valor_tx +", 0, 0, 0, 0, NULL, NULL, NULL, NULL, " + id_entidad_recaudo + ", '" + cedula + "', '" + factura + "', NULL, NULL, '" + id_cajero + "', " + id_entidad_adquiriente + ", " + id_entidad_autorizadora + ", " + id_entidad_adquiriente + ", " + id_entidad_adquiriente + ", " + id_entidad_autorizadora +", " + id_entidad_autorizadora + ", 860, " + resultado_transaccion + ", NULL, NULL, NULL, '" + billetesIn + "', NULL, '" + coinsIn + "', NULL, NULL, 0, 0, '1000', 0, 0, 0, NULL, NULL, NULL);";
    dbConnection.query(sql, function(err, result){
        if(err){
            console.log(err)
            resPost.status(200).json({
                status:'error',
                code:"999",
                msg:'Error inserting transaction in DB',
            })
        }
        else{
            done(secuencia);
        }
    });
}

module.exports.insertResetCounter = function(cedula, id_entidad_recaudo, id_entidad_adquiriente, id_entidad_autorizadora, id_cajero, valor_tx, num_factura, resultado_transaccion, billetesIn, coinsIn, userid,resPost,done){
    var factura = (num_factura === undefined ? "NULL": num_factura);
    var d = new Date,
        dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
            d.getDate().padLeft(),
            ].join('-') +' ' +
            [d.getHours().padLeft(),
            d.getMinutes().padLeft(),
            d.getSeconds().padLeft()].join(':'),
        dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
            d.getDate().padLeft(),
            ].join('-');
    var diaSep = ("00" + d.getDate()).split('');
    var dia = diaSep[diaSep.length-2] + '' + diaSep[diaSep.length-1];
    var horaSep = ("00" + d.getHours()).split('');
    var hora = horaSep[horaSep.length-2] + '' + horaSep[horaSep.length-1];
    var minSep = ("00" + d.getMinutes()).split('');
    var min = minSep[minSep.length-2] + '' + minSep[minSep.length-1];
    var secSep = ("00" + d.getSeconds()).split('');
    var sec = secSep[secSep.length-2] + '' + secSep[secSep.length-1];
    var mesSep = ("00" + (d.getMonth()+1)).split('');
    var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
    var secuencia =[dia,hora, min, sec].join('');
    var sql = "INSERT INTO `movimiento_" + d.getFullYear() + mes + "` VALUES(NULL, '" + dformatHour + "', NULL, '" + dformat + "', '" + dformatHour + "', '" + userid + "', NULL, NULL, '" + secuencia + "', NULL, " + valor_tx +", 0, 0, 0, 0, NULL, NULL, NULL, NULL, " + id_entidad_recaudo + ", '" + cedula + "', '" + factura + "', NULL, NULL, '" + id_cajero + "', " + id_entidad_adquiriente + ", " + id_entidad_autorizadora + ", " + id_entidad_adquiriente + ", " + id_entidad_adquiriente + ", " + id_entidad_autorizadora +", " + id_entidad_autorizadora + ", 900, " + resultado_transaccion + ", NULL, NULL, NULL, '" + billetesIn + "', NULL, '" + coinsIn + "', NULL, NULL, 0, 0, '1000', 0, 0, 0, NULL, NULL, NULL);";
    dbConnection.query(sql, function(err, result){
        if(err){
            console.log(err)
            resPost.status(200).json({
                status:'error',
                code:"999",
                msg:'Error inserting transaction in DB',
            })
        }
        else{
            done(secuencia, dformatHour);
        }
    });
}