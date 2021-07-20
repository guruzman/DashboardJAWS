//PadLeft Number
Number.prototype.padLeft = function(base,chr){
    var  len = (String(base || 10).length - String(this).length)+1;
    return len > 0? new Array(len).join(chr || '0')+this : this;
}

// Include the cluster module
var cluster = require('cluster');

// Code to run if we're in the master process
if (cluster.isMaster) {

    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;
	console.log("CPU COUNT", cpuCount)
    // Create a worker for each CPU
    for (var i = 0; i < 1; i += 1) {
        cluster.fork();
    }

    // Listen for terminating workers
    cluster.on('exit', function (worker) {

        // replace the terminated workers
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();

    });

// Code to run if we're in a worker process
} else {
    //Server modules
    //npm modules
	const express = require('express');
	const uuid = require('uuid/v4')
	const session = require('express-session')
	const FileStore = require('session-file-store')(session);
	const bodyParser = require('body-parser');
	const passport = require('passport');
	const LocalStrategy = require('passport-local').Strategy;
	const cors = require('cors');
	var cookieParser = require('cookie-parser');
	const cron = require('cron');
	let multer = require('multer');
	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
		  cb(null, './csv/')
		},
		filename: function (req, file, cb) {
			cb(null, file.originalname);
		}
	  });
	var upload = multer({ storage: storage }).single('file');

	//Nodemailer
	//TLS para nodemailer
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

	//Project modules
	const dbConnection = require('./DB/dbConnection.js');
	const encrypter = require('./encrypter.js');

	const nodemailer = require('nodemailer');
	const { Parser } = require('json2csv');

	var transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			   user: 'iprocessi.col@gmail.com',
			   pass: 'padreehijo11'
		}
	});

	//Prueba de envio de email

	/*transporter.sendMail({
		from: 'iprocessi.col@gmail.com', // sender address
		to: 'sassmus@Gmail.com', // list of receivers
		subject: 'Prueba iprocessi', // Subject line
		html: '<p>Prueba nodemailer</p>',// plain text body
	  }, function (err, info) {
		if(err)
		  console.log(err)
		else
		  console.log(info);
	 });*/

	 var AWS = require('aws-sdk');
	const csv = require('csvtojson');
	// Set the Region 
		
	const groupBy = (array, key, key1, key2, fecha) => {
		var grouped = [];
		var vacios = 0,
		novacios = 0;
		array.forEach((element) => {
			var fechaelement = element[fecha].split('-')[1] + "" + element[fecha].split('-')[2];
			var found = grouped.find((inserted) => {
				var fechainserted = inserted[0][fecha].split('-')[1] + "" + inserted[0][fecha].split('-')[2];
				if(element[key] !== '' && element[key] !== undefined){
					vacios++;
					return (inserted[0][key] == element[key]);	
				}
				else{
					novacios++;
					return (inserted[0][key1] == element[key1] && inserted[0][key2] == element[key2] && fechaelement.split(' ')[0] == fechainserted.split(' ')[0]);
				}
			});
			
			if(found !== undefined){
				found.push(element);
			}
			else{
				var res = [];
				res.push(element);
				grouped.push(res);
			}
		});
		return grouped;
	};

	var leers3 = function (next) {
		console.log("Entra a s3")
		var executed = []

		AWS.config.update({
			region: 'us-east-1',
			accessKeyId: 'AKIAVLQSISBZ4PX4GG2V',
			secretAccessKey: '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'
		});
	
		var s3 = new AWS.S3();

		s3.listObjects({Bucket:'ftp-iprocessi', Prefix: 'Pro/', MaxKeys: 2}, async function(err, data) {
            if (err) {
                console.log(fechaActual() + " Error: Error ejecutando cruce con S3.")
            }else{
				var files = [];
                data.Contents.forEach(function(obj){
					if(obj.Key.startsWith("Pro/") && !obj.Key.startsWith("Pro/Formato_ant") && obj.Key !== "Pro/"){
						files.push(obj.Key);
						console.log(obj.Key)
					}
				})
				await Promise.all(
					files.map((file) => {
						console.log("Fucking file", file);
						const id_cajero =  (file.startsWith('Pro/C_') || file.startsWith('Pro/CP_')) ? file.split('_')[1] : file.split('_')[0].split('Pro/')[1];
						const params = {Bucket:'ftp-iprocessi', Key: file};
						console.log("Id cajero",id_cajero)
						const sql = "SELECT id_entidad FROM cajero WHERE id_cajero = '" + id_cajero + "';";
						return new Promise((resolve, reject) => {
							dbConnection.query(sql, async(err,result) => {
								if(err) console.log(err);
								else if(result[0] !== undefined){
									console.log("result", result[0].id_entidad);
									var fileExecutedData = await leerarchivos3(params, s3, id_cajero, result[0].id_entidad);
									console.log(fileExecutedData);
									fileExecutedData.file = file;
									executed.push(fileExecutedData);
									return resolve();
								}
								else{
									paramsCopy = {
										Bucket: 'ftp-iprocessi',
										CopySource: 'ftp-iprocessi' + '/' + file,
										Key: file.replace('Pro/', 'Ordenado-pro/no-encontrados/')
									};
									s3.copyObject(paramsCopy, function(copyErr, copyData){
										console.log("Begin deleting")
										if (copyErr) {
										  console.log("Error copiando a s3", err);
										}
										else {
										  console.log('Copied: ', paramsCopy.Key);
										  s3.deleteObject({Bucket: 'ftp-iprocessi', Key: file}, (err, result) => {
											  if(err) console.log(fechaActual(), "Error eliminando",err);
											  else{
												  console.log('Deleted', file);
											}
										  });
										}
									});
									return null;
								}
							})
						})
					})
				)
				console.log("Executed", executed);
				next(executed, s3);
			}
		})
	};

	var leers3Ordenar = function (next) {
		console.log("Entra a s3")
		var executed = []

		AWS.config.update({
			region: 'us-east-1',
			accessKeyId: 'AKIAVLQSISBZ4PX4GG2V',
			secretAccessKey: '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'
		});
	
		var s3 = new AWS.S3();

		s3.listObjects({Bucket:'ftp-iprocessi', Prefix: 'Cargado-pro/', MaxKeys: 5000}).eachPage(async function(err, data) {
            if (err) {
                console.log(fechaActual() + " Error: Error ejecutando cruce con S3.")
            }else{
				var files = [];
                data.Contents.forEach(function(obj){
					if(obj.Key.startsWith("Cargado-pro/") && obj.Key !== "Pro/"){
						files.push(obj.Key);
					}
				})
				next(files, s3);
			}
		})
	};

	var leerarchivos3 = async function (params, s3, id_cajero, entidad) {
		var inserts = 0,
		updates = 0;
		const stream = s3.getObject(params).createReadStream();
		var json = await csv().fromStream(stream);		
		
		var grouped = groupBy(json, "idUnicoLocal", "id_operacion", "id_usuario", "fecha");
		var transacciones = grouped.map((array) => {
			var suma = 0;
			array.forEach(element => {
				suma += parseFloat(element["descripcion"]);
			});
			return {
				id:array[0]["id"],
				fecha:array[array.length-1]["fecha"],
				valor:suma,
				id_operacion:array[0]["id_operacion"],
				tipo:array[0]["tipo"],
				dispositivo:array[0]["dispositivo"],
				id_usuario:array[0]["id_usuario"],
				reg_unico: array[0]["idUnicoLocal"],
				id_entidad: array[0]["id_compania"],
			}
		});
		if(transacciones.length > 0){
			//res.status(200).json({"transacciones": transacciones});
			const fecha1 = new Date(transacciones[0].fecha);
			formatRetiro = [fecha1.getFullYear(),(fecha1.getMonth()+1).padLeft(),
				fecha1.getDate().padLeft(),
				].join('-'),
			formatHourRetiro = [fecha1.getFullYear(),(fecha1.getMonth()+1).padLeft(),
				fecha1.getDate().padLeft(),
				].join('-') +' ' +
				[fecha1.getHours().padLeft(),
				fecha1.getMinutes().padLeft(),
				fecha1.getSeconds().padLeft()].join(':');
			var mesSepRetiro = ("00" + (fecha1.getMonth()+1)).split('');
			var mesRetiro = mesSepRetiro[mesSepRetiro.length-2] + '' + mesSepRetiro[mesSepRetiro.length-1]
			var sql = "SELECT fecha_retiro_valores FROM movimiento_" + fecha1.getFullYear() + "" + mesRetiro + " " + 
			"WHERE id_cajero = '" + id_cajero + "' AND fecha_autorizacion >= '" + formatHourRetiro + "' AND fecha_retiro_valores IS NOT NULL ORDER BY fecha_retiro_valores ASC LIMIT 1;";
			
			dbConnection.query(sql, (err , result) => {
				if(err){
					console.log(fechaActual() + " " + err);
				}
				else{
					//console.log(sql, result);
					var fechaConsulta = result.length > 0 ? new Date(result[0].fecha_retiro_valores) : null,
					fecha_retiro = fechaConsulta !== null ? [fechaConsulta.getFullYear(),(fechaConsulta.getMonth()+1).padLeft(),
						fechaConsulta.getDate().padLeft(),
						].join('-') +' ' +
						[fechaConsulta.getHours().padLeft(),
						fechaConsulta.getMinutes().padLeft(),
						fechaConsulta.getSeconds().padLeft()].join(':') : '';

					transacciones.forEach((transaccion) => {
						var fecha_transaccion = new Date(transaccion.fecha);
						//console.log(fecha_transaccion)
						dformat = [fecha_transaccion.getFullYear(),(fecha_transaccion.getMonth()+1).padLeft(),
							fecha_transaccion.getDate().padLeft(),
							].join('-'),
						dformatHour = [fecha_transaccion.getFullYear(),(fecha_transaccion.getMonth()+1).padLeft(),
							fecha_transaccion.getDate().padLeft(),
							].join('-') +' ' +
							[fecha_transaccion.getHours().padLeft(),
							fecha_transaccion.getMinutes().padLeft(),
							fecha_transaccion.getSeconds().padLeft()].join(':');
						var mesSep = ("00" + (fecha_transaccion.getMonth()+1)).split('');
						var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
						//console.log(transaccion)

						if(transaccion.reg_unico !== undefined && transaccion.reg_unico !== '' && transaccion.reg_unico !== ""){
							var sql = "select id_movimiento, concat(substring(cruce,1,2),'1',substring(cruce,4,1)) as nuevo_cruce, fecha_retiro_valores from movimiento_" + fecha_transaccion.getFullYear() + "" + mes + " " +
							"where " +
							"id_cajero = '" + id_cajero + "' " +
							"and reg_unico = " + transaccion.reg_unico + " " +
							"and valor_tx = '" + transaccion.valor + "' " +
							"and id_tipo_transaccion = 860 ORDER BY autorizacion DESC LIMIT 1";
							//console.log(sql)
							dbConnection.query(sql, (err, result) => {
								//console.log(transaccion, sql, result);
								if(err){
									console.log(err);
								}
								else if(result.length >= 1){
									updates++;
									updatecruce(fecha_transaccion, result);
								}
								else{
									inserts++;
									insertcruce(fecha_transaccion,dformatHour, dformat, result, transaccion, id_cajero, entidad, fecha_retiro, transaccion.reg_unico)
								}
							})
						}
						else{
							var sql = "select id_movimiento, concat(substring(cruce,1,2),'1',substring(cruce,4,1)) as nuevo_cruce, fecha_retiro_valores from movimiento_" + fecha_transaccion.getFullYear() + "" + mes + " " +
							"where " +
							"id_cajero = '" + id_cajero + "' " +
							"and secuencia = " + transaccion.id_operacion + " " +
							"and ref_recaudo = " + transaccion.id_usuario + " " +
							"and fecha_negocio =  '" + dformat + "' " +
							"and valor_tx = '" + transaccion.valor + "' " +
							"and id_tipo_transaccion = 860 ORDER BY autorizacion DESC LIMIT 1";
							dbConnection.query(sql, (err, result) => {
								if(err){
									console.log(err);
								}
								else if(result.length >= 1){
									updates++;
									updatecruce(fecha_transaccion, result);
								}
								else{
									inserts++;
									insertcruce(fecha_transaccion,dformatHour, dformat, result, transaccion, id_cajero, entidad, fecha_retiro)
								}
							})
						}
						
					})

				}
			})
			return {inserts: inserts,updates: updates};
		}
		else{
			return {inserts: 0, updates: 0};
		}
	}

	var updatecruce = function(fecha_transaccion,result){
		var mesSep = ("00" + (fecha_transaccion.getMonth()+1)).split('');
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
		var sql1 = "UPDATE movimiento_" + fecha_transaccion.getFullYear() + "" + mes + " " +
		"SET cruce = " + result[0].nuevo_cruce + " WHERE id_movimiento = " + result[0].id_movimiento;
		console.log(sql1);
		dbConnection.query(sql1, (err1, result1) => {
			if(err1){
				console.log(err1);
			}
		})
	}

	var insertcruce = function(fecha_transaccion,dformatHour, dformat, result, transaccion, id_cajero, id_entidad, fecha_retiro, reg_unico){
		console.log(transaccion);

		var sql = "SELECT * FROM " +
		"(SELECT  id_cajero,C.id_entidad,nombre,T.valor_comision FROM cajero C " +
		"JOIN comision T ON C.id_red = T.id_red " +
		"WHERE Serial = '" + id_cajero + "' " +
		"AND T.Fecha_inicial <= '" + dformat + "' AND T.Fecha_final >= '" + dformat + "' " + 
		"AND T.valor_inicial <= " + transaccion.valor + " AND T.valor_final >= " + transaccion.valor + " " + 
		"AND T.Id_entidad = '" + transaccion.id_entidad + "' " + 
		"UNION ALL " + 
		"SELECT  id_cajero,C1.id_entidad,nombre,0 as valor_comision FROM cajero C1 " + 
		"WHERE Serial = '" + id_cajero + "' " + 
		") AS TABLA " + 
		"ORDER BY valor_comision DESC " + 
		"LIMIT 1";
		dbConnection.query(sql, (err, result) => {
			if(err){
				console.log(fechaActual , err)
			}
			else{
				var mesSep = ("00" + (fecha_transaccion.getMonth()+1)).split('');
				var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
				if(transaccion.id_entidad == '1009') result[0].valor_comision = transaccion.valor * 0.0095;
				var sql1 = "INSERT INTO `movimiento_" + fecha_transaccion.getFullYear() + "" + mes + "` VALUES(NULL, '" + dformatHour + "', NULL, '" + dformat + "', '" + fecha_retiro + "', NULL, NULL, NULL, NULL, " + transaccion.id_operacion + ", '999', " + transaccion.valor +", " + transaccion.valor + ",0, 0, " + (result.length > 0 ? result[0].valor_comision : 0) + ", 0, 0, NULL, NULL, NULL, NULL, '" + transaccion.id_entidad + "', " + transaccion.id_usuario + ", NULL, NULL, NULL, '" + id_cajero + "', '" + id_entidad + "', " + transaccion.id_entidad + ", " + id_entidad + ", " + transaccion.id_entidad + ", " + id_entidad + ", " + transaccion.id_entidad + ", 860, 0, NULL, NULL, NULL,NULL, NULL, NULL, NULL, NULL, 0, 0, '0010', 0, 0, 0, NULL, NULL, " + reg_unico + ");";
				console.log(sql1);
				dbConnection.query(sql1, (err1, result1) => {
					if(err1){
						console.log(err1);
					}
				})
			}
		})
	}

	var createMovimTables = function(){
		const sql = "CREATE TABLE IF NOT EXISTS `movimiento_MOVIM+1` (   `id_movimiento` bigint(20) NOT NULL AUTO_INCREMENT,   `fecha_peticion` datetime NOT NULL COMMENT 'Esta es la fecha de la petición del switch',   `fecha_autorizacion` datetime DEFAULT NULL COMMENT 'Esta es la fecha de respuesta del autorizador',   `fecha_negocio` date NOT NULL COMMENT 'Esta es la fecha en que se paga o cobra una transaccion, la diferencia con la fecha de la transaccion es que la fecha de transaccion es el momento en el que el cliente realiza la transaccion y la fecha de negocio es la fecha en la que los bancos se pagan ',   `fecha_retiro_valores` datetime DEFAULT NULL, `fecha_retiro_monedas` datetime DEFAULT NULL,   `numero_identificacion` varchar(64) DEFAULT NULL COMMENT 'Este es el numero que identifica al cliente ej. tarjeta que realiza la transaccion (generalmente tiene de 16 a 21 digitos)',   `numero_cuenta` varchar(19) DEFAULT NULL COMMENT 'Este es el numero de cuenta de la tarjeta que realiza la transaccion',   `numero_cuenta_dest` varchar(19) DEFAULT NULL COMMENT 'el numero de cuenta destino a la que se le realiza una transferencia',   `secuencia` varchar(8) DEFAULT NULL COMMENT 'Este campo identifica el numero de transaccion segun el consecutivo que maneja cada cajero automatico.',   `autorizacion` text,   `valor_tx` double NOT NULL DEFAULT '0' COMMENT 'Este es el valor monetario de la transaccion. (retiros, avances, transferencias).', `valor_billetes` double NOT NULL DEFAULT '0' COMMENT 'Este es el valor monetario en billetes de la transaccion. (retiros, avances, transferencias).',`valor_monedas` double NOT NULL DEFAULT '0' COMMENT 'Este es el valor monetario en monedas de la transaccion. (retiros, avances, transferencias).',   `costo_tx` double NOT NULL DEFAULT '0',   `valor_comision` double NOT NULL DEFAULT '0' COMMENT 'Este valor se trae de la tabla comision. Debe ser equivalente a el valor asignado a la comision de la entidad adquiriente - autorizadora, para una transaccion con un resultado especifico. (Ej. Cliente Banco de Bogota en cajero bancolombia realizando un re',   `id_reverso_tlf` int(11) NOT NULL DEFAULT '0' COMMENT 'Este campo indica si una transaccion es reversada total, parcial o no reversada segun el archivo TLF:\n\n0=no reversada\n1=reversada totalmente\n2=reversada parcialmente',   `valor_reverso_tlf` double NOT NULL DEFAULT '0' COMMENT 'Este es el valor monetario del reverso segun el archivo TLF realizado para una transaccion, por defecto es 0',   `id_reverso_adq` int(11) DEFAULT NULL COMMENT 'Este campo indica si una transaccion es reversada total, parcial o no reversada segun el archivo Adquiriente\n\n0=no reversada\n1=reversada totalmente\n2=reversada parcialmente',   `valor_reverso_adq` double DEFAULT NULL COMMENT 'Este es el valor monetario del reverso segun el archivo Adquiriente realizado para una transaccion, por defecto es 0',   `id_reverso_aut` int(11) DEFAULT NULL COMMENT 'Este campo indica si una transaccion es reversada total, parcial o no reversada segun el archivo Autorizador\n\n0=no reversada\n1=reversada totalmente\n2=reversada parcialmente',   `valor_reverso_aut` double DEFAULT NULL COMMENT 'Este es el valor monetario del reverso segun el archivo Autorizador realizado para una transaccion, por defecto es 0',   `id_entidad_recaudo` int(11) DEFAULT NULL COMMENT 'este es el id de la empresa a la que se le hace el recaudo para operaciones de pagos',   `ref_recaudo` varchar(50) DEFAULT NULL COMMENT 'este campo es la identificacion del cliente para la empresa del recaudo (Ej. en las facturas de telefono existe el NIE que es el mismo para TODAS las facturas de un cliente determinado)',   `num_factura` varchar(64) DEFAULT NULL COMMENT 'este campo identifica el consecutivo de la factura para una entidad de recaudo.',   `id_entidad_donacion` int(11) DEFAULT NULL COMMENT 'este es el id de la entidad a la que se le recibe la donacion',   `valor_donacion` double DEFAULT NULL COMMENT 'el valor monetario de la donacion realizada en la transaccion',   `id_cajero` varchar(15) NOT NULL COMMENT 'este es el id del cajero que realizo la transaccion',   `id_entidad_adquiriente` varchar(20) NOT NULL COMMENT 'es la entidad del cajero que realizo la transaccion, RECUERDE QUE COMO LA LLAVE DE CAJERO ES COMPUESTA, ES NECESARIO QUE ESTE CAMPO ESTE EN ESTA TABLA.',   `id_entidad_autorizadora` varchar(20) NOT NULL COMMENT 'Esta es la entidad DUENA de el cliente que realizo la transaccion',   `id_paga_comision` varchar(20) NOT NULL COMMENT 'Este es el codigo de la entidad a la cual se le paga el valor de la comision',   `id_paga_transaccion` varchar(20) NOT NULL COMMENT 'este es el id de la entidad a la que se le paga el valor de la transaccion',   `id_cobra_comision` varchar(20) NOT NULL COMMENT 'Este es el codigo de la entidad a la cual se le cobra el valor de la comision',   `id_cobra_transaccion` varchar(20) NOT NULL COMMENT 'este es el id de la entidad a la que se le cobra el valor de la transaccion',   `id_tipo_transaccion` int(11) NOT NULL COMMENT 'este es el id del tipo de la transaccion realizada',   `id_tipo_resultado_tlf` int(11) DEFAULT NULL COMMENT 'codigo que identifica el resultado de la operacion segun fue cargado de la tabla tlf_yyyymmdd (ej. 0=exitosa, 8031=clave invalida etc...)',   `id_tipo_resultado_adq` int(11) DEFAULT NULL COMMENT 'codigo que identifica el resultado de la operacion segun fue cargado de la tabla adquiriente_yyyymmdd (ej. 0=exitosa, 8031=clave invalida etc...)',   `id_tipo_resultado_aut` int(11) DEFAULT NULL COMMENT 'codigo que identifica el resultado de la operacion segun fue cargado de la tabla autorizador_yyyymmdd (ej. 0=exitosa, 8031=clave invalida etc...)',   `id_tipo_resultado_tira` int(11) DEFAULT NULL COMMENT 'codigo que identifica el resultado de la operacion segun fue cargado de la tabla tira_yyyymmdd (ej. 0=exitosa, 8031=clave invalida etc...)',   `billete_in` varchar(40) DEFAULT NULL COMMENT 'cantidad de billete depositados por cliente xxx por cada denominación desde 1000,2000,5000, etc ',   `billete_out` varchar(30) DEFAULT NULL COMMENT 'cantidad de billetes entregados por el kiosko al  cliente xxx por cada denominación desde 1000,2000,5000, etc',   `moneda_in` varchar(30) DEFAULT NULL COMMENT 'cantidad de monedas depositados por cliente xxx por cada denominación desde 50,100,200, etc ',   `moneda_out` varchar(30) DEFAULT NULL COMMENT 'cantidad de monedas entregados por el kiosko al  cliente xxx por cada denominación desde 50,100,200, etc',   `valor_tira` double DEFAULT NULL COMMENT 'sumatoria del la cantidad de billetes pagados por cada gaveta por la denominacion de cada una',   `estado_reclamo` int(11) NOT NULL DEFAULT '0' COMMENT 'ESTE CAMPO ESPECIFICA SI UNA TRANSACCION TIENE O NO RECLAMO\n\n0=no tiene\n1=si tiene',   `estado_ajuste` int(11) NOT NULL DEFAULT '0' COMMENT 'ESTE CAMPO ESPECIFICA SI UNA TRANSACCION TIENE O NO AJUSTE\n\n0=no tiene\n1=si tiene',   `cruce` varchar(5) NOT NULL COMMENT 'Este campo es calculado en el cruce y esta compuesto por 4 digitos que identifican si la transaccion estaba o no en los diferentes archivos cargados en el sistema',   `ajuste` int(11) DEFAULT '0' COMMENT '0 Movimiento 1-Ajuste',   `retry` int(11) DEFAULT NULL COMMENT 'Si quisco no recibio respuesta reintenta. 0 original 1 para reintento',   `uf_int2` int(11) DEFAULT NULL COMMENT 'Uso Futuro INT',   `fecha_certificacion_tdv` datetime DEFAULT NULL COMMENT 'Uso Futuro DATETIME',   `archivo_tira` text COMMENT 'Nombre del archivo detalle Tx transmitido en resetcounter VARCHAR',   `reg_unico` text COMMENT 'codigo quisco mas milisengondo, numero único de transaccion en iprocessi',   PRIMARY KEY (`id_movimiento`),   KEY `fk_mov_cajero*MOVIM+1*` (`id_entidad_adquiriente`,`id_cajero`),   KEY `fk_mov_recaudo*MOVIM+1*` (`id_entidad_recaudo`),   KEY `fk_mov_donacion*MOVIM+1*` (`id_entidad_donacion`),   KEY `fk_cajero_movimiento*MOVIM+1*` (`id_cajero`,`id_entidad_adquiriente`),   KEY `fk_ent_mov_autorizadora*MOVIM+1*` (`id_entidad_autorizadora`),   KEY `fk_ent_mov_paga_comi*MOVIM+1*` (`id_paga_comision`),   KEY `fk_ent_mov_paga_transac*MOVIM+1*` (`id_paga_transaccion`),   KEY `fk_ent_mov_cobra_comi*MOVIM+1*` (`id_cobra_comision`),   KEY `fk_ent_mov_cobra_transac*MOVIM+1*` (`id_cobra_transaccion`),   KEY `fk_id_tipo_transaccion*MOVIM+1*` (`id_tipo_transaccion`) ) ENGINE=InnoDB  DEFAULT CHARSET=latin1 COMMENT='CRUCE DE ARCHIVOS CARGADOS' AUTO_INCREMENT=0 ;";
		//const sqlView = "CREATE VIEW View_MOVIM+1 AS SELECT fecha_negocio,M.id_cajero,M.id_tipo_transaccion,id_entidad_adquiriente,id_entidad_autorizadora,id_paga_transaccion,id_cobra_transaccion,id_paga_comision,id_cobra_comision,id_tipo_resultado_tlf, sum(valor_tx) as valor_Tx, sum(valor_comision) as valor_Comision, count(*) as cantidad, C.nombre as kiosko, G.id_geografia_padre as id_geografia_padre, G.id_geografia as id_geografia, G.nombre as geografia, R.Id_red as Id_red, R.nombre as red, T.entrada_salida FROM `movimiento_MOVIM+1` M, cajero C , geografia G, red R, tipo_transaccion T Where substring(cruce,1,1)=1 and M.id_cajero = C.id_cajero and C.id_geografia = G.id_geografia and C.id_red = R.id_red and M.id_tipo_transaccion = T.id_tipo_transaccion GROUP BY `fecha_negocio`,`id_cajero`,`id_tipo_transaccion`,id_entidad_adquiriente,`id_entidad_autorizadora`,`id_paga_transaccion`,`id_cobra_transaccion`,`id_paga_comision`,`id_cobra_comision`,`id_tipo_resultado_tlf`"
		var fecha = fechaActual();
		for(var i = 0; i < 6 ; i++){
			var mes = ('00' + (fecha.getMonth() == 11? 1 : fecha.getMonth() + 2)).split('').slice(1).slice(-2).join('');
			var anio = fecha.getMonth() == 11? fecha.getFullYear() + 1: fecha.getFullYear();
			if (fecha.getMonth() == 11) {
				fecha = new Date(fecha.getFullYear() + 1, 0, 1);
			} else {
				fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
			}
			var sqlactual = sql.split('MOVIM+1').join('' + anio + '' + mes);
			console.log('' + anio + mes);
			dbConnection.query(sqlactual, (err, result) => {
				if(err) {
					console.log("Error creando tablas de movim.")
					console.log(err);
				}
				else{
					console.log("Creado" + anio + '' + mes);
				}
			})
		}
	}

	var createViewTables = function(){
		const sql = "CREATE VIEW View_MOVIM+1 AS SELECT fecha_negocio,M.id_cajero,M.id_tipo_transaccion,id_entidad_adquiriente,id_entidad_autorizadora,id_paga_transaccion,id_cobra_transaccion,id_paga_comision,id_cobra_comision,id_tipo_resultado_tlf, sum(valor_tx) as valor_Tx, sum(valor_billetes) as valor_billetes, sum(valor_monedas) as valor_monedas,sum(valor_comision) as valor_Comision, count(*) as cantidad, C.nombre as kiosko, G.id_geografia_padre as id_geografia_padre, G.id_geografia as id_geografia, G.nombre as geografia, R.Id_red as Id_red, R.nombre as red, T.entrada_salida FROM `movimiento_MOVIM+1` M, cajero C , geografia G, red R, tipo_transaccion T Where substring(cruce,1,1)=1 AND (autorizacion <> '' OR autorizacion is not null) and M.id_cajero = C.id_cajero and C.id_geografia = G.id_geografia and C.id_red = R.id_red and M.id_tipo_transaccion = T.id_tipo_transaccion GROUP BY `fecha_negocio`,`id_cajero`,`id_tipo_transaccion`,id_entidad_adquiriente,`id_entidad_autorizadora`,`id_paga_transaccion`,`id_cobra_transaccion`,`id_paga_comision`,`id_cobra_comision`,`id_tipo_resultado_tlf`";
		var fecha = fechaActual();
		for(var i = 0; i < 3 ; i++){
			var mes = ('00' + (fecha.getMonth() == 11? 1 : fecha.getMonth() + 2)).split('').slice(1).slice(-2).join('');
			var anio = fecha.getMonth() == 11? fecha.getFullYear() + 1: fecha.getFullYear();
			if (fecha.getMonth() == 11) {
				fecha = new Date(fecha.getFullYear() + 1, 0, 1);
			} else {
				fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
			}
			var sqlactual = sql.split('MOVIM+1').join('' + anio + '' + mes);
			dbConnection.query(sqlactual, (err, result) => {
				if(err && err.errno !== 1050) {
					console.log("Error creando tablas de view.")
					console.log(err);
				}
				else{
					console.log("Creado " + anio + '' + mes);
				}
			});
		}
	}

	/*var executeJobs = function(){
		var sql = "SELECT * FROM job WHERE ACTIVO = 1;";
		
		dbConnection.query(sql, (err, result) => {
			if(err){
				console.log(err);
			}
			else{
				result.forEach((element) => {

					var fecha = fechaActual();
					var fechaAnterior = new Date(new Date().setDate(fecha.getDate() - 1));
					var fechaSiguiente = new Date(new Date().setDate(fecha.getDate() + 1));
					

					var mesmenos1 = fecha.getMonth() == 0? 12 : fecha.getMonth();
					var aniomenos1 = fecha.getMonth() == 0? fecha.getFullYear() - 1: fecha.getFullYear(); 

					var mesmas1 = fecha.getMonth() == 11? 1 : fecha.getMonth() + 2;
					var aniomas1 = fecha.getMonth() == 11? fecha.getFullYear() + 1: fecha.getFullYear();

					var mesSep = ("00" + (fecha.getMonth()+1)).split('');
					var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
					
					var mesSepAnterior = ("00" + (fechaAnterior.getMonth()+1)).split('');
					var mesAnterior = mesSepAnterior[mesSepAnterior.length-2] + '' + mesSepAnterior[mesSepAnterior.length-1];

					var mesSepSiguiente= ("00" + (fechaSiguiente.getMonth()+1)).split('');
					var mesSiguiente = mesSepSiguiente[mesSepSiguiente.length-2] + '' + mesSepSiguiente[mesSepSiguiente.length-1];

					dformat = [fecha.getFullYear(),(fecha.getMonth()+1).padLeft(),
						fecha.getDate().padLeft(),
						].join('-');

					dformatAnterior = [fechaAnterior.getFullYear(),(fechaAnterior.getMonth()+1).padLeft(),
						fechaAnterior.getDate().padLeft(),
						].join('-');

					dformatSiguiente = [fechaSiguiente.getFullYear(),(fechaSiguiente.getMonth()+1).padLeft(),
						fechaSiguiente.getDate().padLeft(),
						].join('-');

					sql = element.query;
					sql = sql.split('*MOVIM*').join(fecha.getFullYear() + mes);
					sql = sql.split('*MOVIM-HOY*').join('' + fechaAnterior.getFullYear() + mesAnterior);
					sql = sql.split('*MOVIM-1*').join('' + aniomenos1 + '' + mesmenos1);
					sql = sql.split('*MOVIM+1*').join('' + aniomas1 + '' + mesmas1);

					sql = sql.split('*HOY*').join('' + dformat);
					sql = sql.split('*HOY+1*').join('' + dformatSiguiente);
					sql = sql.split('*HOY-1*').join('' + dformatAnterior);
					console.log(sql + ' \n');
					dbConnection.query(sql, function(err, result) {
						console.log(result);
						if(err){
							console.log("Error enviando email : " + err);
						}
						else{
							if(result.length > 0){
								var fields = Object.keys(result[0]);
								try {
									const parser = new Parser(fields);
									const csv = parser.parse(result);

									const subject = element.asunto !== null ? element.asunto.replace('*HOY*', '' + dformat).replace('*HOY-1*', '' + dformatAnterior).replace('*HOY+1*', '' + dformatSiguiente) : '';
									const nombreArchivo = element.nombre !== null ? element.nombre.replace('*HOY*', '' + dformat).replace('*HOY-1*', '' + dformatAnterior).replace('*HOY+1*', '' + dformatSiguiente): '';
									const destinaries = element.para !== null ? element.para.split(';'): '';
									const CC = element.copia !== null ? element.copia.split(';') : '';
									var text = element.texto1 !== null ? element.texto1 : '' + "\n" + element.texto2 !== null ? element.texto2 : '' + "\n" + element.despedida !== null ? element.despedida : '' + "\n" + element.firma !== null ? element.firma : '';
									if(element.texto1 == 'señores Rappi'){
										console.log(element);
										console.log( element.texto2 !== null + " " + element.texto2)
										console.log("Texto 2 " + element.texto2 !== null ? element.texto2 : '')
										console.log(element.texto1 !== null ? element.texto1 : '' + "\n" + element.texto2 !== null ? element.texto2 : '' + "\n" + element.despedida !== null ? element.despedida : '' + "\n" + element.firma !== null ? element.firma : '');
									}
									
									
									//console.log(csv);

									transporter.sendMail({
										from: 'iprocessi.col@gmail.com', // sender address
										to: destinaries, // list of receivers
										cc: CC,
										subject: subject, // Subject line
										text: text,
										attachments: {
											filename: nombreArchivo + '.csv',
											content: csv,
											contentType: 'text/csv'
										}
									  }, function (err, info) {
										if(err)
										  console.log(err)
										else
										  console.log(info);
									 })

								  } catch (err) {
									console.error(err);
								  }
							}
						}
					})
				});
			}
		});
	}*/

	var Client = require('ftp');
	var fs = require('fs');

	var executeJobs = function(){
		console.log("Entra a job");
		var sql = "SELECT * FROM job WHERE ACTIVO = 1;";
		dbConnection.query(sql, (err, result) => {
			if(err){
				console.log(err);
			}
			else{
				//console.log(result);
				result.forEach((element) => {

					
						var fecha = fechaActual();
						var fechaAnterior = new Date(new Date().setDate(fecha.getDate() - 1));
						var fechaSiguiente = new Date(new Date().setDate(fecha.getDate() + 1));
						
	
						var mesmenos1 = fecha.getMonth() == 0? 12 : fecha.getMonth();
						var aniomenos1 = fecha.getMonth() == 0? fecha.getFullYear() - 1: fecha.getFullYear(); 
	
						var mesmas1 = fecha.getMonth() == 11? 1 : fecha.getMonth() + 2;
						var aniomas1 = fecha.getMonth() == 11? fecha.getFullYear() + 1: fecha.getFullYear();
	
						var mesSep = ("00" + (fecha.getMonth()+1)).split('');
						var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
	
						var mesSepAnterior = ("00" + (fechaAnterior.getMonth()+1)).split('');
						var mesAnterior = mesSepAnterior[mesSepAnterior.length-2] + '' + mesSepAnterior[mesSepAnterior.length-1];
	
						var mesSepSiguiente= ("00" + (fechaSiguiente.getMonth()+1)).split('');
						var mesSiguiente = mesSepSiguiente[mesSepSiguiente.length-2] + '' + mesSepSiguiente[mesSepSiguiente.length-1];
	
						dformat = [fecha.getFullYear(),(fecha.getMonth()+1).padLeft(),
							fecha.getDate().padLeft(),
							].join('-');

						dformatAnterior = [fechaAnterior.getFullYear(),(fechaAnterior.getMonth()+1).padLeft(),
							fechaAnterior.getDate().padLeft(),
							].join('-');

						dformatSiguiente = [fechaSiguiente.getFullYear(),(fechaSiguiente.getMonth()+1).padLeft(),
							fechaSiguiente.getDate().padLeft(),
							].join('-');
	
						sql = element.query;
						sql = sql.split('*MOVIM*').join(fecha.getFullYear() + mes);
						sql = sql.split('*MOVIM-HOY*').join('' + fechaAnterior.getFullYear() + mesAnterior);
						sql = sql.split('*MOVIM-1*').join('' + aniomenos1 + '' + mesmenos1);
						sql = sql.split('*MOVIM+1*').join('' + aniomas1 + '' + mesmas1);
	
						sql = sql.split('*HOY*').join('' + dformat);
						sql = sql.split('*HOY+1*').join('' + dformatSiguiente);
						sql = sql.split('*HOY-1*').join('' + dformatAnterior);
						dbConnection.query(sql, function(err, result) {
							//console.log(result);
							if(err){
								console.log("Error enviando email : " + err);
							}
							else{
								//console.log(result.length);
								if(result.length > 0){
										var fields = Object.keys(result[0]);
									try {
										const parser = new Parser(fields);
										const csv = parser.parse(result);
										const nombreArchivo = element.nombre !== null ? element.nombre.replace('*HOY*', '' + dformat).replace('*HOY-1*', '' + dformatAnterior).replace('*HOY+1*', '' + dformatSiguiente): '';
										if(element.para !== null && element.para !== undefined && element.para != '' ){
											console.log("Format ", dformatAnterior)
											const subject = element.asunto !== null ? element.asunto.replace('*HOY*', '' + dformat).replace('*HOY-1*', '' + dformatAnterior).replace('*HOY+1*', '' + dformatSiguiente) : '';
											const destinaries = element.para !== null ? element.para.split(';'): '';
											const CC = element.copia !== null ? element.copia.split(';') : '';
											var text = element.texto1 !== null ? element.texto1 : '' + "\n" + element.texto2 !== null ? element.texto2 : '' + "\n" +
											sql + '\n' +
											element.despedida !== null ? element.despedida : '' + "\n" + element.firma !== null ? element.firma : '';
											/*if(element.texto1 == 'señores Rappi'){
												console.log( element.texto2 !== null + " " + element.texto2)
												console.log("Texto 2 " + element.texto2 !== null ? element.texto2 : '')
												console.log(element.texto1 !== null ? element.texto1 : '' + "\n" + element.texto2 !== null ? element.texto2 : '' + "\n" + element.despedida !== null ? element.despedida : '' + "\n" + element.firma !== null ? element.firma : '');
											}*/
											console.log(nombreArchivo)
											transporter.sendMail({
												from: 'iprocessi.col@gmail.com', // sender address
												to: destinaries, // list of receivers
												cc: CC,
												subject: subject, // Subject line
												text: text,
												attachments: {
													filename: nombreArchivo + '.csv',
													content: csv,
													contentType: 'text/csv'
												}
											}, function (err, info) {
												if(err)
												console.log(err)
												else{
													console.log(info);
												}
											})
										
											if(element.Host !== null && element.Host != '' && element.Host !== undefined){
												console.log("Nombre", nombreArchivo)
												fs.writeFile(__dirname + '/FTP/' + nombreArchivo + '.csv', csv, function(err) {
													if (err) throw err;
													//console.log('file saved');
													
													var c = new Client();
													c.on('ready', function() {
														c.put(__dirname + '/FTP/' + nombreArchivo + ".csv", nombreArchivo + '.csv', function(err) {
															if (err) throw err;
															c.end();
															fs.unlink(__dirname + "/FTP/" + nombreArchivo + ".csv", (err) => {
																if (err) throw err;
															});
														});
													});
													c.connect({
														host: element.Host,
														user:element.user,
														password: element.password,
											
													});
												});
											}
										}		
									}
									catch (err) {
											console.error(err);
									}
								}
							}
						})		
							
				});
			}
		});
	}

	const job = cron.job('30 8 * * *', () => {
		console.log("Generando archivo para enviar email a media noche. " + fechaActual().toString());
		executeJobs();
	})

	job.start();

	const movims = cron.job('0 2 * * MON', () => {
		console.log("Creando tablas de omvimientos para los siguientes 6 meses " + fechaActual().toString());
		createMovimTables();
	})
	
	movims.start();

	const views = cron.job('30 2 * * MON', () => {
		console.log("Creando tablas de vistas para los siguientes 3 meses " + fechaActual().toString());
		createViewTables();
	})
	
	views.start();

	const cruce = cron.job('*/2 7-12 * * *', () => { //Derecha es para servidor en produccion, izquierda en local
		console.log("Ejecutando cruce " + fechaActual().toString());
		leers3((executed, s3) => {
			executed.forEach((element) => {
				const file = element.file,
				idcajero =  (file.startsWith('Pro/C_') || file.startsWith('Pro/CP_')) ? file.split('_')[1] : file.split('/')[1].split('_')[0],
				paramsCopy = {
					Bucket: 'ftp-iprocessi',
					CopySource: 'ftp-iprocessi' + '/' + file,
					Key: file.replace('Pro/', 'Ordenado-pro/' + idcajero + '/')
				  };
				  s3.copyObject(paramsCopy, function(copyErr, copyData){
					if (copyErr) {
					  console.log(copyErr);
					}
					else {
					  console.log('Copied: ', paramsCopy.Key);
					  s3.deleteObject({Bucket: 'ftp-iprocessi', Key: file}, (err, result) => {
						  if(err) console.log(err);
						  else{
							  console.log('Deleted', paramsCopy.Key);
						  }
					  });
					}
				});
				
			})
		});
	})
	
	cruce.start();

	const certificacionesTDV = new cron.CronJob('0 17 * * *', function() {
		//certificar();
	}, null, true, 'America/Bogota');
	
	certificacionesTDV.start();

	function certificar(){
		console.log("Certificando");
		var fecha = fechaActual(),
		mesSep = ("00" + (fecha.getMonth()+1)).split(''),
		mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1],

		mesmenos1sep = ("00" + (fecha.getMonth() == 0? 12 : fecha.getMonth())).split(''),
		mesmenos1 = mesmenos1sep[mesmenos1sep.length-2] + '' + mesmenos1sep[mesmenos1sep.length-1],
		aniomenos1 = fecha.getMonth() == 0? fecha.getFullYear() - 1: fecha.getFullYear(),

		dformatHour = [fecha.getFullYear(),(fecha.getMonth()+1).padLeft(),
			fecha.getDate().padLeft(),
			].join('-') +' ' +
		   [fecha.getHours().padLeft(),
			fecha.getMinutes().padLeft(),
			fecha.getSeconds().padLeft()].join(':'),
		dformat = [fecha.getFullYear(),(fecha.getMonth()+1).padLeft(),
			fecha.getDate().padLeft(),
			].join('-'),
			
		sql = "SELECT G.nombre AS Ciudad, E.nombre AS Entidad, sum(valor_tx) monto, " + 
		"sum(substring(billete_in,1,4)) as '1000', " + 
		"sum(substring(billete_in,5,4)) as '2000', " + 
		"sum(substring(billete_in,9,4)) as '5000', " + 
		"sum(substring(billete_in,13,4)) as '10000', " + 
		"sum(substring(billete_in,17,4)) as '20000', " + 
		"sum(substring(billete_in,21,4)) as '50000', " + 
		"sum(substring(billete_in,25,4)) as '100000' " + 
		"FROM (SELECT * FROM movimiento_" + fecha.getFullYear() + "" + mes + " UNION ALL SELECT * FROM movimiento_" + aniomenos1 + "" + mesmenos1 + ") M, " + 
		"cajero C, entidad E, geografia G WHERE id_tipo_transaccion = 860 " + 
		"AND C.id_geografia = G.id_geografia " +
		"AND M.fecha_certificacion_tdv is null " +
		"AND E.id_entidad = M.id_entidad_autorizadora " + 
		"AND C.id_cajero = M.id_cajero " +   
		"GROUP BY C.id_geografia, id_entidad_autorizadora;";
		
		const destinatarios = ['sardila9623@gmail.com', 'cto@cashlogic.co','jrodriguez@atlastransvalores.com.co']; 
		console.log(sql);
		
		dbConnection.query(sql, (err, result) => {
			if(err){
				console.log(dformatHour, err);
				transporter.sendMail({
					from: 'iprocessi.col@gmail.com', // sender address
					to: destinatarios, // list of receivers
					subject: "Error enviando certificaciones a TDV", // Subject line
					text: dformatHour + " error enviando la certificación.",
				}, function (err, info) {
					if(err)
					console.log(err)
					else{
						console.log(info);
					}
				})
			}
			else if(result.length > 0){
				var fields = Object.keys(result[0]);
				const parser = new Parser(fields);
				const csv = parser.parse(result);

				transporter.sendMail({
					from: 'iprocessi.col@gmail.com', // sender address
					to: destinatarios, // list of receivers
					subject: "Certificacion TDV", // Subject line
					text: "Adjunto encontrará un CSV con los valores por quiosco",
					attachments: {
						filename: dformat + '.csv',
						content: csv,
						contentType: 'text/csv'
					}
				}, function (err, info) {
					if(err)
					console.log(err)
					else{
						console.log(info);
					}
				})

				sql = "UPDATE movimiento_" + fecha.getFullYear() + "" + mes + " SET fecha_certificacion_tdv = '" + dformatHour + "' WHERE id_tipo_transaccion = 860 " + 
				"AND fecha_certificacion_tdv is null;";
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(dformatHour, err);
						transporter.sendMail({
							from: 'iprocessi.col@gmail.com', // sender address
							to: destinatarios, // list of receivers
							subject: "Error actualizando fechas de certificaciones a TDV", // Subject line
							text: dformatHour + " error actualizando fechas de certificación.",
						}, function (err, info) {
							if(err)
							console.log(err)
							else{
								console.log(info);
							}
						})
					}
				})

				sql = "UPDATE movimiento_" + aniomenos1 + "" + mesmenos1 + " SET fecha_certificacion_tdv = '" + dformatHour + "' WHERE id_tipo_transaccion = 860 " + 
				"AND fecha_certificacion_tdv is null;";
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(dformatHour, err);
						transporter.sendMail({
							from: 'iprocessi.col@gmail.com', // sender address
							to: destinatarios, // list of receivers
							subject: "Error actualizando fechas de certificaciones a TDV", // Subject line
							text: dformatHour + " error actualizando fechas de certificación.",
						}, function (err, info) {
							if(err)
							console.log(err)
							else{
								console.log(info);
							}
						})
					}
				})
			
			}
		});
	}


	//OTPAuth
	const OTPAuth = require('otpauth');
	const base32 = require('rfc-3548-b32');
	


	// create the server
	const app = express();

	//URL front
	const URLfront = 'https://www.iprocessi.com';
	const URLfront2 = 'https://iprocessi.com';

	var fechaActual = function(){
		const nDate = new Date().toLocaleString('en-US', {
			timeZone: 'America/Bogota'
		});
		return new Date(nDate);
	}

	Number.prototype.padLeft = function(base,chr){
	var  len = (String(base || 10).length - String(this).length)+1;
	return len > 0? new Array(len).join(chr || '0')+this : this;
	}

	function main(){

	// configure passport.js to use the local strategy
	passport.use(new LocalStrategy(
		{ usernameField: 'username' },
		(username, password, done) => {
			d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
			   [d.getHours().padLeft(),
				d.getMinutes().padLeft(),
							  d.getSeconds().padLeft()].join(':');
		var sql = "SELECT * FROM usuario WHERE estado = 1 AND identificacion_usuario = '" + username + "';";
		dbConnection.query(sql, (err, result) => {
			if(err){
				console.log(err);
				return done(null, false, { message: 'Error consultando la base de datos.\n' });
			}
			else if(result.length == 0){
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/login','" + username + "','" + dformat + "','Intento de login con usuario no existe.');"
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login fallido de: " + id_usuario)})
				return done(null, false, { message: 'Usuario o contraseña errados.' });
			}
			else{
				console.log("Econtró usuario");
			const pswEncrypted = result[0].pwd;
			var primero = pswEncrypted.slice(1);
			var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
			var realEncrypted = segundo.slice(0, -1);
			console.log(realEncrypted)
			encrypter.checkHash(password, realEncrypted, (logged) =>{
				const user = result[0];
				var id_usuario = result[0].id_usuario;
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/login','" + result[0].id_usuario + "','" + dformat + "','Login exitoso del usuario');"
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login exitoso de: " + id_usuario)})
				return done(null, user);
			}, () =>{
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/login','" + result[0].id_usuario + "','" + dformat + "','Contraseña errada');"
				dbConnection.query(sql, (err, result) => {if(err) console.log(err)})
				return done(null, false, { message: 'Usuario o contraseña errados.' });
			});
			}
		})
		}
	));

	// add & configure middleware
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());
	app.use(cookieParser('oifh98dsuf9d8spbuisdf'));
	var whitelist = ["https://www.iprocessi.com", "https://iprocessi.com","http://localhost:3000","localhost:3000","*"];
		
	var cors = function(req, res, next) {
		var origin = req.headers.origin;
		if (whitelist.indexOf(origin) > -1) {
			res.setHeader('Access-Control-Allow-Origin', origin);
		}
		res.setHeader('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
		res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
		res.setHeader('Access-Control-Allow-Headers', "Origin, X-Requested-With, Content-Type, Accept");
		res.setHeader('Access-Control-Allow-Credentials', true);
		next();
	}
	app.use(cors);

	
	app.get('/view',(req, res) => {
		createViewTables(res);
	})

	app.get('/job',(req, res) => {
		executeJobs();
	})

	app.get('/certificar' ,(req, res) => {
		certificar();
	})

	app.use(session({
		genid: (req) => {
		return uuid() // use UUIDs for session IDs
		},
		store: new FileStore(),
		secret: 'oifh98dsuf9d8spbuisdf',
		resave: false,
		saveUninitialized: false
	}))
	app.use(passport.initialize());
	app.use(passport.session());
	app.use('/apidoc', express.static(__dirname + '/public/apidoc'));


	// tell passport how to serialize and deserialize the user
	passport.serializeUser((user, done) => {
		done(null, user.id_usuario);
	});

	passport.deserializeUser((id, done) => {
		var sql = "SELECT * FROM usuario WHERE id_usuario = " + id + ";";
		dbConnection.query(sql, (err, result) => {
		if (err){
			console.log(err);
			done(err, false);
		}
		else{
			done(null, result);
		}
		})
	});
	
	// create the homepage route at '/'
	app.get('/', (req, res) => {
		res.send(`You got home page!\n` + " " + fechaActual());
	})
	
	// create the login get and post routes
	app.get('/login', (req, res) => {
		res.send(`You got the login page!\n`)
	})

	app.post('/cruzar', (req, res) => {
		console.log("Comienza a cruzar");
		leers3((executed, s3) => {
			console.log(executed);
			//Mover en S3
			executed.forEach((element) => {
				console.log(element);
				const file = element.file,
				idcajero =  (file.startsWith('Pro/C_') || file.startsWith('Pro/CP_')) ? file.split('_')[1] : file.split('/')[1].split('_')[0],
				paramsCopy = {
					Bucket: 'ftp-iprocessi',
					CopySource: 'ftp-iprocessi' + '/' + file,
					Key: file.replace('Pro/', 'Ordenado-pro/' + idcajero + '/')
				};
				s3.copyObject(paramsCopy, function(copyErr, copyData){
					console.log("Begin deleting")
					if (copyErr) {
					  console.log("Error copiando a s3", err);
					}
					else {
					  console.log('Copied: ', paramsCopy.Key);
					  s3.deleteObject({Bucket: 'ftp-iprocessi', Key: file}, (err, result) => {
						  if(err) console.log(fechaActual(), "Error eliminando",err);
						  else{
							  console.log('Deleted', file);
						}
					  });
					}
				});
			})
		});
	})

	
	app.post('/ordenar', (req, res) => {
		console.log("Comienza a ordenar");
		leers3Ordenar((executed, s3) => {
			//Mover en S3
			var ids = [];
			executed.forEach((element) => {
				const file = element;
				if(!element.startsWith('Cargado-pro/BCK') && (file.startsWith('Cargado-pro/C_') || file.startsWith('Cargado-pro/CP_') || file.startsWith('Cargado-pro/000')))
				{
					const idcajero =  (file.startsWith('Cargado-pro/C_') || file.startsWith('Cargado-pro/CP_')) ? file.split('_')[1] : file.split('/')[1].split('_')[0];
					/*var newKey = element.split('/').filter(function(item,i,allItems){
						return i==allItems.indexOf(item);
					}).join('/');*/
					var paramsCopy = {
						Bucket: 'ftp-iprocessi',
						CopySource: 'ftp-iprocessi' + '/' + file,
						Key: file.replace('Cargado-pro/', 'Ordenado-pro/' + idcajero + '/')
					};
					console.log(paramsCopy);
					s3.copyObject(paramsCopy, function(copyErr, copyData){
						if (copyErr) {
						console.log(copyErr);
						}
						else {
						console.log('Copied: ', paramsCopy.Key);
						s3.deleteObject({Bucket: 'ftp-iprocessi', Key: file}, (err, result) => {
							if(err) console.log(fechaActual(), err);
							else{
								console.log('Deleted', paramsCopy.Key);
							}
						});
						}
					});
				}
			})
			res.status(200).json({result:executed});
		});
	})

	

	app.get("/screenshot", function(req, res, next) {
		const cajero = req.query.cajero;
		var sql = "SELECT Serial FROM cajero WHERE id_cajero = '" + cajero + "';";
		//
		dbConnection.query(sql, (err, result) => {
			console.log(result);
			if(err){
				console.log(fechaActual(),err);
				res.status(200).json({code:2, message: "Error descargando la imagen."});
			}
			else if(result.length > 0){
				const serial = result[0].Serial;
				AWS.config.update({
					region: 'us-east-1',
					accessKeyId: 'AKIAVLQSISBZ4PX4GG2V',
					secretAccessKey: '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'
				});
			
				var s3 = new AWS.S3();
				console.log("/Estado_cajeros/estado_" + serial + ".png");
				var params = { Bucket: 'imagenes-iprocessi', Key: "Estado_cajeros/estado_" + serial + ".png" };
				s3.getObject(params, function(err, data) {
				  if (err) {
						return res.send({ error: err });
				  }
					  res.send(data.Body);
				});
			}
			else{
				res.status(200).json({code:2, message: "No se encuentra imagen para ese kiosko."})
			}
		}) 

		
	});

	//job7

	/**
       * @api {post} /login Iniciar sesión
       * @apiName Login
       * @apiGroup Inicio de sesion
       *
       * @apiParam {String} username Cédula o correo electrónico del usuario.
	   * @apiParam {String} password Contraseña del usuario.
       *
       * @apiSuccess {JSON} JSON Información del inicio de sesión
    */
	app.post('/login', (req, res, next) => {
		passport.authenticate('local', (err, user, info) => {
		if(info) {return res.status(200).json({'code':1,'message':info.message})}
		if (err) {return next(err); }
		if (!user) {return res.status(200).json({'code':1,'message':'Usuario o contraseña errados'}); }
		req.login(user, (err) => {
			if (err) { return next(err); }
			return res.redirect('/authrequired?rol=' + user.rol_idrol + "&renovacion=" + user.fecha_renovacion_pwd);
		})
		})(req, res, next);
	})

	app.post('/solicitarscreenshot', (req, res) => {
		if(req.isAuthenticated()){

			const cajero = req.body.idcajero;
			var sql = "SELECT * FROM cajero WHERE id_cajero = " + cajero + ";";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err);
					res.status(200).json({code:2, message: "Error solicitando screenshot al cajero."})
				}
				else if( result.length == 0){
					res.status(200).json({code:2, message: "No se encontró el cajero para solicitar screenshot."})
				}
				else{
					const d = fechaActual(),
					dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
						d.getDate().padLeft(),
						].join('-') +' ' +
						[d.getHours().padLeft(),
						d.getMinutes().padLeft(),
						d.getSeconds().padLeft()].join(':');
					sql = "INSERT INTO eventos_keepalive VALUES('','" + dformatHour + "', 'Pantalla', NULL, '" + cajero + "','');";
					dbConnection.query(sql, (err, result) => {
						//
						if(err){
							console.log(fechaActual(), err);
							res.status(200).json({code:2, message: "Error solicitando screenshot al cajero."})
						}
						else{
							res.status(200).json({code:0, message: "Solicitud de pantallazo enviada."})
						}
					})
				}
			})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/solicitarfoto', (req, res) => {
		if(req.isAuthenticated()){

			const cajero = req.body.idcajero;
			var sql = "SELECT * FROM cajero WHERE id_cajero = " + cajero + ";";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err);
					res.status(200).json({code:2, message: "Error solicitando foto al cajero."})
				}
				else if( result.length == 0){
					res.status(200).json({code:2, message: "No se encontró el cajero para solicitar foto."})
				}
				else{
					const d = fechaActual(),
					dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
						d.getDate().padLeft(),
						].join('-') +' ' +
						[d.getHours().padLeft(),
						d.getMinutes().padLeft(),
						d.getSeconds().padLeft()].join(':');
					sql = "INSERT INTO eventos_keepalive VALUES('','" + dformatHour + "', 'camPic', NULL, '" + cajero + "','');";
					dbConnection.query(sql, (err, result) => {
						//console.log(sql);
						if(err){
							console.log(fechaActual(), err);
							res.status(200).json({code:2, message: "Error solicitando screenshot al cajero."})
						}
						else{
							res.status(200).json({code:0, message: "Solicitud de foto enviada."})
						}
					})
				}
			})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/solicitarvideo', (req, res) => {
		if(req.isAuthenticated()){

			const {idcajero, idUnico} = req.body;
			var sql = "SELECT * FROM cajero WHERE id_cajero = " + idcajero + ";";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err);
					res.status(200).json({code:2, message: "Error solicitando video al cajero."})
				}
				else if( result.length == 0){
					res.status(200).json({code:2, message: "No se encontró el cajero para solicitar video."})
				}
				else{
					const d = fechaActual(),
					dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
						d.getDate().padLeft(),
						].join('-') +' ' +
						[d.getHours().padLeft(),
						d.getMinutes().padLeft(),
						d.getSeconds().padLeft()].join(':');
					sql = "INSERT INTO eventos_keepalive VALUES('','" + dformatHour + "', 'videoTransaccion', 'idUnico:" + idUnico + "', '" + idcajero + "','');";
					dbConnection.query(sql, (err, result) => {
						//console.log(sql);
						if(err){
							console.log(fechaActual(), err);
							res.status(200).json({code:2, message: "Error solicitando video al cajero."})
						}
						else{
							res.status(200).json({code:0, message: "Solicitud de video enviada."})
						}
					})
				}
			})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/solicitardebt', (req, res) => {
		if(req.isAuthenticated()){

			const cajero = req.body.idcajero;
			var sql = "SELECT * FROM cajero WHERE id_cajero = " + cajero + ";";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err);
					res.status(200).json({code:2, message: "Error solicitando debt al cajero."})
				}
				else if( result.length == 0){
					res.status(200).json({code:2, message: "No se encontró el cajero para solicitar debt."})
				}
				else{
					const d = fechaActual(),
					dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
						d.getDate().padLeft(),
						].join('-') +' ' +
						[d.getHours().padLeft(),
						d.getMinutes().padLeft(),
						d.getSeconds().padLeft()].join(':');
					sql = "INSERT INTO eventos_keepalive VALUES('','" + dformatHour + "', 'debt', 'usuario:" + req.body.referencia + "', '" + cajero + "','');";
					dbConnection.query(sql, (err, result) => {
						//
						if(err){
							console.log(fechaActual(), err);
							res.status(200).json({code:2, message: "Error solicitando debt al cajero."})
						}
						else{
							res.status(200).json({code:0, message: "Solicitud de debt enviada."})
						}
					})
				}
			})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/solicitarActualizarHora', (req, res) => {
		if(req.isAuthenticated()){

			const cajero = req.body.idcajero;
			var sql = "SELECT * FROM cajero WHERE id_cajero = " + cajero + ";";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err);
					res.status(200).json({code:2, message: "Error solicitando actualizar hora al cajero."})
				}
				else if( result.length == 0){
					res.status(200).json({code:2, message: "No se encontró el cajero para solicitar actualizar hora."})
				}
				else{
					const d = fechaActual(),
					dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
						d.getDate().padLeft(),
						].join('-') +' ' +
						[d.getHours().padLeft(),
						d.getMinutes().padLeft(),
						d.getSeconds().padLeft()].join(':');
					sql = "INSERT INTO eventos_keepalive VALUES('','" + dformatHour + "', 'ActualizarHora', NULL, '" + cajero + "','');";
					dbConnection.query(sql, (err, result) => {
						//
						if(err){
							console.log(fechaActual(), err);
							res.status(200).json({code:2, message: "Error solicitando actualizar hora al cajero."})
						}
						else{
							res.status(200).json({code:0, message: "Solicitud de actualizar hora enviada."})
						}
					})
				}
			})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/solicitarestado', (req, res) => {
		if(req.isAuthenticated()){

			const cajero = req.body.idcajero,
			tipo = req.body.tipo,
			milis = req.body.milis;
			var sql = "SELECT * FROM cajero WHERE id_cajero = " + cajero + ";";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err);
					res.status(200).json({code:2, message: "Error solicitando estado del cajero."})
				}
				else if( result.length == 0){
					res.status(200).json({code:2, message: "No se encontró el cajero para solicitar el estado."})
				}
				else{
					const d = fechaActual(),
					dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
						d.getDate().padLeft(),
						].join('-') +' ' +
						[d.getHours().padLeft(),
						d.getMinutes().padLeft(),
						d.getSeconds().padLeft()].join(':');

					sql = "SELECT * FROM eventos_keepalive WHERE id_cajero = '" + cajero + "' AND params = 'tipo:" + tipo + "'";
					dbConnection.query(sql, (err, result) => {
						if(err){
							console.log(fechaActual(), err);
							res.status(200).json({code:2, message: "Error solicitando estado del cajero."})
						}
						else if(result.length > 0){
							res.status(200).json({code:0, message: "Ya existe una solicitud para ese estado."})
						}
						else{
							sql = "INSERT INTO eventos_keepalive VALUES('','" + dformatHour + "', 'Estado', 'tipo:" + tipo + "', '" + cajero + "', " + milis + ");";
							//
							dbConnection.query(sql, (err, result) => {
								if(err){
									console.log(fechaActual(), err);
									res.status(200).json({code:2, message: "Error solicitando estado del cajero."})
								}
								else{
									res.status(200).json({code:0, message: "Solicitud de estado enviada."})
								}
							})
						}
					})
				}
			})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.post('/solicitarestadotodos', (req, res) => {
		if(req.isAuthenticated()){
			if(req.body.kiosks.length > 0){
				d = fechaActual(),
				dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
					[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
					d.getSeconds().padLeft()].join(':');
				const kiosks = req.body.kiosks.map((kiosk) => {
					return ['', dformatHour, 'Estado','tipo:1',kiosk.value,'5000'];
				})
				var sql = "INSERT into eventos_keepalive VALUES ?";
				dbConnection.query(sql, [kiosks], (err, result) => {
					if(err){
						console.log(fechaActual(), err);
						res.status(200).json({code:2, message: "Error solicitando estado del cajero."})
					}
					else{
						res.status(200).json({code:0, message: "Solicitud de estado enviada a todos los quioscos."})
					}
				})

			}
			else{
				res.status(200).json({code:2, message: "Debe ingresar uno o mas quioscos para enviar la solicitud."})
			}
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post("/cambiarModo", (req, res) => {
		if(req.isAuthenticated()){
			const cedula = req.user[0].identificacion_usuario,
			modo = req.body.modo,
			cajero = req.body.cajero,
			d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
				[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':');

			var sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/cambiarModo','" + cedula + "','" + dformat + "','El usuario solicitó poner el kiosko " + req.body.cajero + " en mantenimiento, modo anterior " + modo + "');";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err)
				}
			})
			const password = req.body.pwd;
			const pswEncrypted = req.user[0].pwd;
			var primero = pswEncrypted.slice(1);
			var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
			var realEncrypted = segundo.slice(0, -1);

			encrypter.checkHash(password, realEncrypted, (logged) =>{
				
				const d = fechaActual(),
				dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
					[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
					d.getSeconds().padLeft()].join(':');
		
					sql = "INSERT INTO eventos_keepalive VALUES ('', '" + dformatHour + "', 'Mant', 'status:" + (modo == 99 ? 'ON':'OFF') + ",usuario:" + cedula + "', '" + cajero + "','')";
					//
				dbConnection.query(sql, (err, result) => {
					console.log(result);
					if(err){
						console.log(fechaActual(), err);
						res.status(200).json({code:2, message: "Error solicitando cambio de modo al cajero."})
					}
					else{
						res.status(200).json({code:0, message: (modo == 1 ? 'Enviando solicitud para entrar en línea.':'Enviando solicitud para entrar en mantenimiento.')})
					}
				})


			}, () => {
				res.status(200).json({code:0, message:"Contraseña errada."})
			});

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})

	app.post("/reiniciarkiosko", (req, res) => {
		if(req.isAuthenticated()){
			const cedula = req.user[0].identificacion_usuario;
			var d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
				[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':');

			var sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/reiniciarkiosko','" + cedula + "','" + dformat + "','El usuario solicitó reiniciar el kiosko " + req.body.cajero + "');";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err)
				}
			})
			const password = req.body.pwd;
			const pswEncrypted = req.user[0].pwd;
			var primero = pswEncrypted.slice(1);
			var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
			var realEncrypted = segundo.slice(0, -1);

			encrypter.checkHash(password, realEncrypted, (logged) =>{
				const modo = req.body.modo,
				cajero = req.body.cajero,
				d = fechaActual(),
				dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
					[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
					d.getSeconds().padLeft()].join(':');
		
				sql = "INSERT INTO eventos_keepalive VALUES ('', '" + dformatHour + "', 'ReiniciaKiosko', 'usuario:" + cedula + "', '" + cajero + "','')";
				
				dbConnection.query(sql, (err, result) => {
					console.log(result);
					if(err){
						console.log(fechaActual(), err);
						res.status(200).json({code:2, message: "Error solicitando reinicio del cajero."})
					}
					else{
						res.status(200).json({code:0, message: "Solicitud de reiniciar el cajero enviada."});
					}
				})

			}, () => {
				res.status(200).json({code:0, message:"Contraseña errada."})
			});

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})

	app.post("/abrirPuerta", (req, res) => {
		if(req.isAuthenticated()){
			const cedula = req.user[0].identificacion_usuario;
			var d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
				[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':');

			var sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/abrirPuerta','" + cedula + "','" + dformat + "','El usuario solicitó pabrir la puerta del cajero " + req.body.cajero + "');";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual(), err)
				}
			})
			const password = req.body.pwd;
			const pswEncrypted = req.user[0].pwd;
			var primero = pswEncrypted.slice(1);
			var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
			var realEncrypted = segundo.slice(0, -1);

			encrypter.checkHash(password, realEncrypted, (logged) =>{
				const modo = req.body.modo,
				cajero = req.body.cajero,
				d = fechaActual(),
				dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
					[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
					d.getSeconds().padLeft()].join(':');

					var sql = "SELECT Serial FROM cajero WHERE id_cajero = '" + cajero + "';";
					dbConnection.query(sql, (err, result) => {
						if(err){
							console.log(fechaActual(), err);
							res.status(200).json({code:2, message: "Error solicitando la apertura adel cajero."})
						}
						else{
							const serial = result[0].Serial;
							var secret = serial + cedula +"LZnjuOLRmd";
							var b32 = (base32.encode(secret)).split('=')[0];
							//console.log(b32);
							if(!b32.includes('=')){
								let totp = new OTPAuth.TOTP({
									issuer: 'Sebastian',
									label: 'Andres',
									algorithm: 'SHA1',
									digits: 6,
									period: 180,
									secret: OTPAuth.Secret.fromB32(b32)
								});

								let token = totp.generate();
								sql = "INSERT INTO eventos_keepalive VALUES ('', '" + dformatHour + "', 'AuthMeToken', 'usuario:" + cedula + ",token:" + token + ",TimeStamp:" + Date.now() + "', '" + cajero + "','')";
								
								dbConnection.query(sql, (err, result) => {
									console.log(result);
									if(err){
										console.log(fechaActual(), err);
										res.status(200).json({code:2, message: "Error solicitando la apertura del cajero."})
									}
									else{
										res.status(200).json({code:0, message: "Solicitando apertura del cajero."})
									}
								})
							}
						}
					})

			}, () => {
				res.status(200).json({code:0, message:"Contraseña errada."})
			});

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})

	app.post('/solicitarAnyDesk', (req, res) => {
		if(req.isAuthenticated()){
			if(req.user[0].identificacion_usuario == 80877703){			
				const cedula = req.user[0].identificacion_usuario;
				var date = fechaActual(),
				dformat = [date.getFullYear(),(date.getMonth()+1).padLeft(),
					date.getDate().padLeft(),
					].join('-') +' ' +
					[date.getHours().padLeft(),
					date.getMinutes().padLeft(),
					date.getSeconds().padLeft()].join(':');

				var sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/solicitarAnyDesk','" + cedula + "','" + dformat + "','El usuario solicitó activar AnyDesk para el quiosco " + req.body.cajero + "');";
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(fechaActual(), err)
					}
				})
			
				const milis = req.body.milis,
				cajero = req.body.cajero,
				d = fechaActual(),
				dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
					[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
					d.getSeconds().padLeft()].join(':');
				sql = "INSERT INTO eventos_keepalive VALUES ('', '" + dformatHour + "', 'AnyON', 'usuario:" + cedula + ",milis:" + milis + "', '" + cajero + "','')";
				dbConnection.query(sql, (err, result) => {
					console.log(result);
					if(err){
						console.log(fechaActual(), err);
						res.status(200).json({code:2, message: "Error solicitando activar AnyDesk."})
					}
					else{
						res.status(200).json({code:0, message: "Se solicitó activar AnyDesk correctamente."})
					}
				})
			}
			else{
				res.status(200).json({code:0,'message':'Por el momento no se puede solicitar habilitar Anydesk.'});
			}
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /clavefuncionario Clave funcionario
       * @apiName Clave Funcionario
       * @apiGroup Parametros
       *
       * @apiParam {String} identificacion Cédula del usuario.
	   * @apiParam {String} pwdanteriro Contraseña anterior del funcionario.
	   * @apiParam {String} pwdnueva Contraseña nueva del funcionario
       *
       * @apiSuccess {JSON} JSON Información del cambio de contraseña del funcionario
    */

	
	app.post('/clavefuncionario', (req, res) => {
		if(req.isAuthenticated()){
			var identificacion = req.body.identificacion;
			var pwdanterior = req.body.pwdanterior;
			var pwdnueva= req.body.pwdnueva;
			var sql = "SELECT pwd, id_usuario_kiosko FROM usuario_kiosko WHERE id_usuario_kiosko = '" + identificacion + "';";
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(err);
				else{
					if(result.length == 0){
						res.status(200).json({'code':0,'message':'No existe un funcionario con esa identificación'});
					}
					else{
						var primero = result[0].pwd.slice(1);
						var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
						var encryptedpwd = segundo.slice(0, -1);
						var d = fechaActual(),
							dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
								d.getDate().padLeft(),
								].join('-') +' ' +
							[d.getHours().padLeft(),
								d.getMinutes().padLeft(),
							  d.getSeconds().padLeft()].join(':');
							  //console.log(pwdanterior);
							  //console.log(result[0].pwd);
							  //console.log(encryptedpwd);
						encrypter.checkHash(pwdanterior, encryptedpwd, (response) => {
							if(pwdnueva !== pwdanterior){
								encrypter.encrypt(pwdnueva, (hash) => {
									var id_sep = result[0].id_usuario_kiosko.split('');
									var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
									sql = "UPDATE usuario_kiosko set PWD = '" + final + "' WHERE id_usuario_kiosko = '" + identificacion + "';"
									dbConnection.query(sql, (err, result) => {
										if(err) {
											console.log(err);
											res.status(200).json({'code':0,'message':'Error cambiando la contraseña'});
										}
										else{
											res.status(200).json({'code':0,'message':'Contraseña cambiada'});
											sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/clavefuncionario','" + req.user[0].id_usuario + "','" + dformat + "','Funcionario modificó su contrasena, identificación: " + identificacion + "');"								
											dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Contraseña de funcionario cambiada")});
											sql = "UPDATE ususario_por_kiosko SET crear_en_kiosko = 1 WHERE id_usuario_kiosko = '" + identificacion + "';";
											dbConnection.query(sql, (err, result) => {
												if(err) {
													console.log(fechaActual(),err);
												}
											})
										}
									})
								});
							}		
						}, () => {
							res.status(200).json({'code':0,'message':'Contraseña errada'});
						});
					}
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /olvidoclave Olvidó Clave
       * @apiName Olvidó Clave
       * @apiGroup Inicio de sesion
       *
       * @apiParam {String} usuario Cédula o correo electrónico del usuario.
       *
       * @apiSuccess {JSON} JSON Información sobre el reinicio de sesión.
    */

	app.post('/olvidoclave', (req,res) => {
		var usuario = req.body.usuario;
		var sql = "SELECT email, identificacion_usuario FROM usuario WHERE identificacion_usuario = '" + usuario + "'";
		dbConnection.query(sql, function(err, result){
			if(err){
				console.log(err);
				res.status(200).json({'code':1,'message':'Error generando nueva contraseña.'});
			}
			else if(result.length < 1){
				res.status(200).json({'code':1,'message':'No se encontró un usuario con su número de identificación o email.'});
			}
			else{
				var correo = result[0].email;
				var pwd = Math.floor(Math.random()*900000) + 100000;
				encrypter.encrypt(pwd, (hash)=>{
				
					var id_sep = result[0].identificacion_usuario.split('');
					var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
					sql = "UPDATE usuario SET pwd = '" + final + "', fecha_renovacion_pwd = '2018-01-01' WHERE identificacion_usuario = '" + result[0].identificacion_usuario + "';";
					dbConnection.query(sql, (err) => {
						if(err){
							console.log(err);
							res.status(200).json({'code':1,'message':'Error generando nueva contraseña.'});
						}
						else{
							transporter.sendMail({
								from: 'iprocessi.col@gmail.com', // sender address
								to: correo, // list of receivers
								subject: "Nueva contraseña", // Subject line
								text: 'Su nueva contraseña en iprocessi es: \n \n \n' + pwd,
								
							  }, function (err, info) {
								if(err){
									console.log(err);
									res.status(200).json({'code':1,'message':'Error generando nueva contraseña, contacté a un administrador de iprocessi.'});  
								}
								else{
									console.log(info);
									res.status(200).json({'code':0,'message':'Su contraseña ha sido reestablecida con exito, por favor revise su correo electrónico.'});  

								}
							 })
						}
					})
				});

				//var mesSep = ("00" + (fecha.getMonth()+1)).split('');
				//var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			}
		})
	})

	/**
       * @api {get} /authrequired Auth Required
       * @apiName Auth Required
       * @apiGroup Dashboard
       *
       *
       * @apiSuccess {JSON} JSON Información si la sesión tiene permisos.
    */
	
	app.get('/authrequired', (req, res) => {
		if(req.isAuthenticated()) {
		var sql = "SELECT * FROM rol_path WHERE id_rol = " + req.query.rol + ";";
		dbConnection.query(sql, (err, result) => {
			if(err){
			console.log(err);
			res.status(200).json({'code':1,'message':'Error retrieving paths.'});
			}
			else{
				var fechaActual = new Date();
				if(fechaActual >= new Date(req.query.renovacion)){
					return res.status(200).json({'code':6,'message':'Contraseña vencida'});
				}else{
					return res.status(200).json({'code':0,'message':'Login exitoso', 'rol':req.query.rol, 'paths':result});
				}
			}
		})
		//
		} else {
		console.log('Entra a redirect ' + new Date().toString());
		res.status(200).json({code:1, message:'Error al iniciar sesión.'});
		}
	})

	app.get('/deserialize',(req,res) => {
		console.log(req.session.passport.user);
		//console.log(req.session.passport.deserializeUser());
		console.log(req.user);
		//deserializeUser()
	});

	/**
       * @api {get} /otpToken OTP Token
       * @apiName OTP Token
       * @apiGroup Quiosco
       *
       * @apiParam {String} pwd Contraseña del usuario del usuario.
	   * @apiParam {String} id_cajero Id del quiosco a consultar.
       *
       * @apiSuccess {JSON} JSON Información del token del quiosco.
    */
	app.get('/otpToken', (req, res) => {
		if(req.isAuthenticated()){
			const password = req.query.pwd;
			const id_cajero = req.query.id_cajero;

			const pswEncrypted = req.user[0].pwd;
			var primero = pswEncrypted.slice(1);
			var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
			var realEncrypted = segundo.slice(0, -1);
			console.log(password)
			console.log(realEncrypted);
			encrypter.checkHash(password, realEncrypted, (logged) =>{
				var d = fechaActual(),
				dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
				[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
								d.getSeconds().padLeft()].join(':'),
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/otptoken','" + req.user[0].id_usuario + "','" + dformat + "','El usuario solicitó el token del kiosko " + id_cajero + "');"
				dbConnection.query(sql, function(err, result){
					if(err) {
						console.log("Error insertando al log de generación de token.");
						console.log(err);
					}
				})
				var sql = "SELECT Serial FROM cajero Where id_cajero = " + id_cajero;
				dbConnection.query(sql, (err, result) => {
					if(err) {
					console.log(err);
					res.status(400).json({code:2,message:'Error generado el token.'});
					}
					else if(result.length === 0){
					res.status(400).json({code:2,message:'No se encontró el cajero.'});
					}
					else{
					let serial = result[0].Serial;
					var secret = serial + "AnJo2TonYaNYPacoPaaca";
					var b32 = (base32.encode(secret)).split('=')[0];
					//console.log(b32);
					if(!b32.includes('=')){
						let totp = new OTPAuth.TOTP({
						issuer: 'Sebastian',
						label: 'Andres',
						algorithm: 'SHA1',
						digits: 6,
						period: 180,
						secret: OTPAuth.Secret.fromB32(b32)
					});
						let token = totp.generate();
						//console.log(token);
						res.status(200).json({token:token,date:(new Date())});
					}
					else{
						res.status(200).json({code:2,'message':'Error generando el token.'});
					}
				}
			})
			
			}, () => {
				res.status(200).json({code:2,'message':'Contraseña errada.'});
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/otpTokenKad', (req, res) => {
		if(req.isAuthenticated()){
			const password = req.query.pwd;
			const id_usuario = req.query.id_usuario;

			const pswEncrypted = req.user[0].pwd;
			var primero = pswEncrypted.slice(1);
			var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
			var realEncrypted = segundo.slice(0, -1);
			encrypter.checkHash(password, realEncrypted, (logged) =>{
				var d = fechaActual(),
				dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
				[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
								d.getSeconds().padLeft()].join(':'),
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/otptokenKAD','" + req.user[0].id_usuario + "','" + dformat + "','El usuario solicitó el token del usuario KAD " + id_usuario + "');"
				dbConnection.query(sql, function(err, result){
					if(err) {
						console.log("Error insertando al log de generación de token.");
						console.log(err);
					}
				})
				var sql = "SELECT Serial FROM cajero Where id_cajero = " + id_cajero;
				dbConnection.query(sql, (err, result) => {
					if(err) {
					console.log(err);
					res.status(400).json({code:2,message:'Error generado el token.'});
					}
					else if(result.length === 0){
					res.status(400).json({code:2,message:'No se encontró el cajero.'});
					}
					else{
					let serial = result[0].Serial;
					var secret = serial + "AnJo2TonYaNYPacoPaaca";
					var b32 = (base32.encode(secret)).split('=')[0];
					//console.log(b32);
					if(!b32.includes('=')){
						let totp = new OTPAuth.TOTP({
						issuer: 'Sebastian',
						label: 'Andres',
						algorithm: 'SHA1',
						digits: 6,
						period: 180,
						secret: OTPAuth.Secret.fromB32(b32)
					});
						let token = totp.generate();
						//console.log(token);
						res.status(200).json({token:token,date:(new Date())});
					}
					else{
						res.status(200).json({code:2,'message':'Error generando el token.'});
					}
				}
			})
			
			}, () => {
				res.status(200).json({code:2,'message':'Contraseña errada.'});
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/otpKAD', (req, res) => {
		if(req.isAuthenticated()){
			const password = req.query.pwd;
			const id_kad = req.query.kad;
			console.log(password, id_kad)
			console.log(req.query);

			const pswEncrypted = req.user[0].pwd;
			var primero = pswEncrypted.slice(1);
			var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
			var realEncrypted = segundo.slice(0, -1);
			console.log
			console.log(realEncrypted)
			encrypter.checkHash(password, realEncrypted, (logged) =>{
				var d = fechaActual(),
				dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-') +' ' +
				[d.getHours().padLeft(),
					d.getMinutes().padLeft(),
								d.getSeconds().padLeft()].join(':'),
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/otpKAD','" + req.user[0].id_usuario + "','" + dformat + "','El usuario solicitó el token del usuario " + id_kad + "');"
				dbConnection.query(sql, function(err, result){
					if(err) {
						console.log("Error insertando al log de generación de token.");
						console.log(err);
					}
					else{
						var secret = id_kad + "4at9k0OD2yk";
						var b32 = (base32.encode(secret)).split('=')[0];
						//console.log(b32);
						if(!b32.includes('=')){
							let totp = new OTPAuth.TOTP({
							issuer: 'Sebastian',
							label: 'Andres',
							algorithm: 'SHA1',
							digits: 6,
							period: 180,
							secret: OTPAuth.Secret.fromB32(b32)
						});
							let token = totp.generate();
							res.status(200).json({token:token,date:(new Date())});
						}
					}
				})
				
			}, () => {
				res.status(200).json({code:2,'message':'Contraseña errada.'});
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/cambiarClave' , (req, res) => {
		encrypter.encrypt(req.body.clave, (hash) =>{
			var id_sep = req.body.cedula.split('');
			var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
			var sql = "UPDATE usuario SET pwd = '" + final + "' WHERE identificacion_usuario = '" + req.body.cedula + "';";
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(err);
				else{
				//console.log(hash);
				}
			})
		})
	})

	/*encrypter.encrypt("Stjuelatodhe1", (hash) => {
		var sql3 = "update usuario SET pwd = '" + hash + "' where identificacion_usuario = '" + 1020820907 + "'";
		console.log(sql3);
		dbConnection.query(sql3, (err, result) => {
			if(err) console.log(err);
			else console.log(result);
		});

	})*/

	/*var sql = "select pwd from usuario where identificacion_usuario ='1020820907'";
	dbConnection.query(sql, (err, result) => {
		encrypter.checkHash("Stjuelatodhe1", result[0].pwd, (response) => {
			console.log(response);
		}, ()=> {
			console.log("Jueputa");
		})
	})*/

	/**
       * @api {post} /actualizarpwd Actualizar Clave
       * @apiName Actualizar Clave
       * @apiGroup Inicio de sesion
       *
       * @apiParam {String} username Cédula o correo electrónico del usuario.
	   * @apiParam {String} anterior Contraseña anterior del usuario.
       *
       * @apiSuccess {JSON} JSON Información de la actulización de la contraseña del usuario.
    */

	app.post('/actualizarpwd', (req, res) => {
		var usuario = req.body.username,
		anterior = req.body.anterior,
		pwd = req.body.pwd;
		pwd2 = req.body.pwd2;
		var sql = "SELECT pwd, identificacion_usuario FROM usuario WHERE identificacion_usuario = '" + usuario + "';";
		dbConnection.query(sql, (err, result) => {
			if(err) {
				console.log(err);
				res.status(400).json({'message':'Error consultado la base de datos.'});
			}
			else if(result.length === 0){
				res.status(400).json({'message':'Usuario o contraseña errados.'});
			}
			else{
				var primero = result[0].pwd.slice(1);
				var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
				var encryptedpwd = segundo.slice(0, -1)
				encrypter.checkHash(anterior, encryptedpwd, (response) => {
					if(pwd === pwd2){
						if(pwd !== anterior){
							var fecha = fechaActual(),
							format = [(fecha.getFullYear()+1),(fecha.getMonth()+1).padLeft(),
								fecha.getDate().padLeft(),
								].join('-');
							encrypter.encrypt(pwd, (hash) => {
								var id_sep = result[0].identificacion_usuario.split('');
								var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
								sql = "UPDATE usuario SET pwd = '" + final + "', dias_vigencia_pwd = 365, fecha_renovacion_pwd = '" + format + "' WHERE identificacion_usuario = '" + usuario + "' ;";
								dbConnection.query(sql, (err, result) => {
									if(err) {
										console.log(err);
										res.status(200).json({'code':6, 'message':'Error actulizando su contraseña.'});
									}
									else{
										res.status(200).json({'code':0, 'message':'Contraseña actualizada'});
									}
								})
							})
						} else{
							res.status(200).json({'code':8,'message':'Debe ingresar una contraseña nueva.'});
						}
					}
					else{
						res.status(200).json({'code':5,'message':'Las contraseñas no coinciden.'});
					}
				}, () => {
					res.status(400).json({'message':'Usuario o contraseña errados.'});
				})
			}
		})
	})

	/**
       * @api {post} /register Registrar Usuario
       * @apiName Registrar Usuario
       * @apiGroup Parametros
       *
       * @apiParam {String} identificacion Cédula del usuario.
	   * @apiParam {String} email Correo electrónico del usuario.
	   * @apiParam {String} nombre Nombre del usuario.
	   * @apiParam {String} apellido1 Primer apellido del usuario.
	   * @apiParam {String} apellido2 Segundo apellido del usuario.
	   * @apiParam {JSON} entidades Entidades asociadas al usuario.
	   * @apiParam {JSON} administradores Administradores asociados al usuario.
	   * @apiParam {Integer} rol Rol del usuario en iProcessi.
       *
       * @apiSuccess {JSON} JSON Información de la creación del usuario.
    */

	app.post('/register',(req,res) => {
		if(req.isAuthenticated()){
			const {identificacion, email, nombre, apellido1, apellido2, entidades, rol, administradores} = req.body;
			const pwd = identificacion;

			var entidadesBoolean = true;
			const entidadesOk = req.user[0].id_entidad == '';
			
			entidades.forEach((element) => {
				if(entidadesBoolean && req.user[0].id_entidad.split(',').indexOf(element.toString()) >= 0){
					entidadesBoolean = true;
				}
				else{
					entidadesBoolean = false;
				}
			})

			var adminBoolean = true;
			const adminOk = req.user[0].id_administrador == '';
			administradores.forEach((element) => {
				if(adminBoolean && req.user[0].id_administrador.split(',').indexOf(element.toString()) >= 0){
					adminBoolean = true;
				}
				else{
					adminBoolean = false;
				}
			})
			if((entidadesBoolean || entidadesOk) && (adminBoolean || adminOk) ){
					var sql = "SELECT * FROM usuario WHERE identificacion_usuario = '" + identificacion + "';";
					dbConnection.query(sql, (err, result) => {
						if(err){
							console.log(err);
							res.status(400).json({'message':'Error creando el usuario'});
							sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/register','" + req.user[0].id_usuario + "','" + dformat + "','Usuario falló al crear nuevo usuario con cédula: " + identificacion + "');"
							dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login exitoso de: " + id_usuario)})
				
						}
						else if(result.length > 0){
							console.log(err);
							sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/register','" + req.user[0].id_usuario + "','" + dformat + "','Usuario intentó crear usuario con cédula que ya existe, cédula: " + identificacion + "');"
							dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login exitoso de: " + id_usuario)})
				
							res.status(400).json({'message':'Ya existe un usuario creado con su identificación o email'});
						}
						else{
							sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/register','" + req.user[0].id_usuario + "','" + dformat + "','Usuario creó nuevo usuario con cédula: " + identificacion + "');"
							dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login exitoso de: " + id_usuario)})
							var id_entidades = entidades !== null ? entidades.join(','): '';
							var id_administradores =  administradores !== null ? administradores.join(','): '';
							var d = fechaActual(),
								dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
									d.getDate().padLeft(),
									].join('-');
							encrypter.encrypt(pwd, function(hash){
								var id_sep = identificacion.toString().split('');
								var encrypted = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
								
								sql = "INSERT INTO usuario (identificacion_usuario, email, pwd, nombre, apellido1, apellido2, id_entidad, rol_idrol, fecha_registro, fecha_renovacion_pwd, dias_vigencia_pwd, id_administrador) VALUES ('" + identificacion + "', '" + email + "', '" + encrypted + "', '" + nombre + "', '" + apellido1 + "', '" + apellido2 + "', '" + id_entidades + "', " + rol + ", '" + dformat + "', '" + dformat + "', 0,'" + id_administradores + "');";
								dbConnection.query(sql, (err, result) => {
									if(err){
										console.log(err);
										res.status(400).json({'message':'Error creando el usuario'});
									}
									else{
										res.status(200).json({'message':'Usuario creado exitosamente.'})
									}
								});
							});
						}
					});
				
			}
			else{
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/register','" + req.user[0].id_usuario + "','" + dformat + "','Usuario falló al crear nuevo usuario con cédula: " + identificacion + "');"
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login exitoso de: " + id_usuario)})
				res.status(400).json({'message':'No tiene permisos para crear un usuario sin adminsitrador ni entidad.'})
			}
			
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}	
	});

	/**
       * @api {post} /registerfuncionario Registrar Funcionario
       * @apiName Registrar Funcionario
       * @apiGroup Parametros
       *
       * @apiParam {String} identificacion Cédula del funcionario.
	   * @apiParam {String} email Correo electrónico del usuario.
	   * @apiParam {String} nombre Nombre del usuario.
	   * @apiParam {JSON} entidades Entidades asociadas al usuario.
	   * @apiParam {JSON} administradores Administradores asociados al usuario.
	   * @apiParam {Integer} tipoUsuario Tipo de funcionario.
	   * @apiParam {Integer} estado Estado del funcionario.
	   * @apiParam {String} pwd Contraseña inicial del funcionario.
       *
       * @apiSuccess {JSON} JSON Información de la creación del funcionario.
    */
	app.post('/registerfuncionario',(req,res) => {
		if(req.isAuthenticated()){
			const {identificacion, email, nombre, entidades, tipoUsuario, administradores, estado, pwd} = req.body;
			//const pwd = identificacion.toString().split('').reverse().join('');
			var entidadesBoolean = true;
			const entidadesOk = req.user[0].id_entidad == '';
			entidades.forEach((element) => {
				if(entidadesBoolean && req.user[0].id_entidad.split(',').indexOf(element.toString()) >= 0){
					entidadesBoolean = true;
				}
				else{
					entidadesBoolean = false;
				}
			})

			var adminBoolean = true;
			const adminOk = req.user[0].id_administrador == '';
			administradores.forEach((element) => {
				if(adminBoolean && req.user[0].id_administrador.split(',').indexOf(element.toString()) >= 0){
					adminBoolean = true;
				}
				else{
					adminBoolean = false;
				}
			})
			if((entidadesBoolean || entidadesOk) && (adminBoolean || adminOk) ){
				
					var sql = "SELECT * FROM usuario_kiosko WHERE id_usuario_kiosko = '" + identificacion + "' OR usuario_kiosko = '" + email + "';";
					dbConnection.query(sql, (err, result) => {
						if(err){
							console.log(err);
							res.status(400).json({'message':'Error creando el funcionario'});
						}
						else if(result.length > 0){
							console.log(err);
							res.status(400).json({'message':'Ya existe un funcionario creado con su identificación o email'});
						}
						else{
							var id_entidades = entidades !== null ? entidades.join(','): '';
							var id_administradores =  administradores !== null ? administradores.join(','): '';
							var d = fechaActual(),
								dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
									d.getDate().padLeft(),
									].join('-');
							var token = "token";
							encrypter.encrypt(pwd, function(hash){
								//console.log(hash);
								var id_sep = identificacion.toString().split('');
								var encrypted = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
								sql = "INSERT INTO usuario_kiosko (id_usuario_kiosko, usuario_kiosko, pwd, nombre, id_tipo_usuario_kiosko, estado, token, fecha_peticion, id_entidad, id_administrador) VALUES ('" + identificacion + "', '" + email + "', '" + encrypted + "', '" + nombre + "', '" + tipoUsuario + "', '" + estado + "', '" + token + "', '" + dformat + "','" + id_entidades + "' ,'" + id_administradores + "');";
								dbConnection.query(sql, (err, result) => {
									if(err){
										console.log(err);
										res.status(400).json({'message':'Error creando el funcionario'});
									}
									else{
										res.status(200).json({'message':'Funcionario creado exitosamente.', 'code':0});
										sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/registerfuncionario','" + req.user[0].id_usuario + "','" + dformat + "','Usuario modificó creó funcionario con identificacion: " + identificacion + "');"								
										dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Funcionario creado")})
									}
								});
							});
						}
					});
				}
			
			
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}	
	});

	app.post('/registerevento', (req, res) => {
		if(req.isAuthenticated()){
			const id = req.body.idevento,
			sigla = req.body.sigla,
			codigo = req.body.codigo,
			descripcion = req.body.descripcion,
			detalle = req.body.detalle,
			rol = req.body.rol.join(',');

			var sql = "SELECT * FROM tipo_evento WHERE id_tipo_evento = '" + id + "'";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(200).json({'message':'Error creando el evento'});

				}
				else if(result.length > 0){
					res.status(200).json({'message':'Ya existe un evento con ese Id.'});
				}
				else{
					sql = "INSERT INTO tipo_evento VALUES ('" + id + "','" + sigla + "','" + codigo + "', " +
					"'" + descripcion + "','" + detalle + "','" + rol + "')";
					dbConnection.query(sql, (err, result) => {
						if(err){
							console.log(err);
							res.status(200).json({'message':'Error creando el evento'});
						}
						else{
							res.status(200).json({'message':'Evento creado exitosamente.', code: 0})
						}
					})
				}
			})

		}else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/registercomision', (req, res) => {
		if(req.isAuthenticated()){
			const {red, entidad, transaccion, fecha_inicial, fecha_final, valor_inicial, valor_final, valor_comision} = req.body;
			sql = "INSERT INTO comision VALUES ('','" + red + "','" + entidad + "', " +
			"'" + transaccion + "','" + fecha_inicial + "','" + fecha_final + "', '" + valor_inicial + "', '" + valor_final + "', '" + valor_comision + "',1)";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(200).json({'message':'Error creando la comisiónn'});
				}
				else{
					res.status(200).json({'message':'Comisión creada exitosamente.', code: 0})
				}
			})
		}else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /deletefuncionario Eliminar Funcionario
       * @apiName Eliminar Funcionario
       * @apiGroup Parametros
       *
       * @apiParam {String} identificacion Cédula del funcionario.
       *
       * @apiSuccess {JSON} JSON Información de la eliminacion del funcionario.
    */
	app.post('/deletefuncionario' , (req, res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			const identificacion = req.body.identificacion;
			var d = fechaActual(),
				dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-'),
				sql = "DELETE FROM usuario_kiosko WHERE id_usuario_kiosko = '" + identificacion + "' " + userCompany + userAdmin + ";";
				//
				dbConnection.query(sql, (err, result) => {
					if(err) console.log(fechaActual() + " " + err);
					else{
						res.status(200).json({'message':'Usuario eliminado exitosamente.'});
					}
				});
				
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}

	})

	//WebServices para el dashboard

	/**
       * @api {post} /updateuser Actualizar Usuario
       * @apiName Actualizar Usuario
       * @apiGroup Parametros
       *
       * @apiParam {String} identificacion Cédula del usuario.
	   * @apiParam {String} email Correo electrónico del usuario.
	   * @apiParam {String} nombre Nombre del usuario.
	   * @apiParam {String} apellido1 Primer apellido del usuario.
	   * @apiParam {String} apellido2 Segundo apellido del usuario.
	   * @apiParam {JSON} entidades Entidades asociadas al usuario.
	   * @apiParam {JSON} administradores Administradores asociados al usuario.
	   * @apiParam {Integer} rol Rol del usuario en iProcessi.
       *
       * @apiSuccess {JSON} JSON Información de la actualización del usuario.
    */
	app.post('/updateuser', (req, res) => {
		if(req.isAuthenticated()){
			const {identificacion, email, nombre, apellido1, apellido2, entidades, rol, administradores} = req.body;
			var id_entidades = entidades.join(',');
			var id_administradores = administradores.join(',')
			var d = fechaActual(),
				dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-');
			sql = "UPDATE usuario SET email = '" + email + "', nombre = '" + nombre  + "', apellido1 = '" + apellido1 + "', apellido2 = '" + apellido2 + "', id_entidad = '" + id_entidades + "',  rol_idrol = '" + rol + "', id_administrador = '" + id_administradores + "' WHERE identificacion_usuario = '" + identificacion + "';";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(400).json({'message':'Error modificando el usuario'});
					sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/updateuser','" + req.user[0].id_usuario + "','" + dformat + "','Error modificando al usuario con cédula: " + identificacion + "');"
					dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login exitoso de: " + id_usuario)})
				}
				else{
					sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/updateuser','" + req.user[0].id_usuario + "','" + dformat + "','Usuario modificó correctamente al usuario con cédula: " + identificacion + "');"
					dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Login exitoso de: " + id_usuario)})
					res.status(200).json({'message':'Usuario modificado exitosamente.'});
				}
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/updateevento', (req, res) => {
		if(req.isAuthenticated()){
			const {idevento, sigla, codigo, descripcion, detalle, rol} = req.body;
			var sql = "UPDATE tipo_evento SET sigla = '" + sigla + "', codigo = '" + codigo + "', descripcion = '" + descripcion + "', detalle = '" + detalle + "', id_rol = '" + rol.join(',') + "' WHERE id_tipo_evento = '" + idevento + "'";
			dbConnection.query(sql,(err, result) => {
				if(err){
					console.log(err);
					res.status(400).json({'message':'Error modificando el evento'});
				}
				else{
					res.status(200).json({'message':'Evento modificado exitosamente.','code':0});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/updatecomision', (req, res) => {
		if(req.isAuthenticated()){
			const {id, red, entidad, transaccion, fecha_inicial, fecha_final, valor_inicial, valor_final, valor_comision} = req.body;
			var sql = "UPDATE comision SET id_red = '" + red + "', id_entidad = '" + entidad + "', id_transaccion = '" + transaccion + "',  fecha_inicial = '" + fecha_inicial + "', fecha_final = '" + fecha_final + "', valor_inicial = '" + valor_inicial + "', valor_final = '" + valor_final + "', valor_comision = '" + valor_comision + "' WHERE  id = '" + id + "';";
			dbConnection.query(sql,(err, result) => {
				if(err){
					console.log(err);
					res.status(400).json({'message':'Error modificando la comisión'});
				}
				else{
					res.status(200).json({'message':'Comisión modificada exitosamente.','code':0});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /updatefuncionario Actualizar Funcionario
       * @apiName Actualizar Funcionario
       * @apiGroup Parametros
       *
       * @apiParam {String} identificacion Cédula del funcionario.
	   * @apiParam {String} email Correo electrónico del usuario.
	   * @apiParam {String} nombre Nombre del usuario.
	   * @apiParam {JSON} entidades Entidades asociadas al usuario.
	   * @apiParam {JSON} administradores Administradores asociados al usuario.
	   * @apiParam {Integer} tipoUsuario Tipo de funcionario.
	   * @apiParam {Integer} estado Estado del funcionario.
	   * @apiParam {String} pwd Contraseña inicial del funcionario.
       *
       * @apiSuccess {JSON} JSON Información de la actualización del funcionario.
    */

	app.post('/updatefuncionario', (req, res) => {
		if(req.isAuthenticated()){
			const {identificacion, email, nombre, entidades, tipoUsuario, administradores, estado} = req.body;
			var id_entidades = entidades.join(',');
			var id_administradores = administradores.join(',')
			var d = fechaActual(),
				dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
					d.getDate().padLeft(),
					].join('-');
			sql = "UPDATE usuario_kiosko SET usuario_kiosko = '" + email + "', nombre = '" + nombre  + "', id_tipo_usuario_kiosko = '" + tipoUsuario + "', estado = '" + estado + "', id_entidad = '" + id_entidades + "',id_administrador = '" + id_administradores + "' WHERE id_usuario_kiosko = '" + identificacion + "';";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(400).json({'message':'Error modificando el funcionario'});
				}
				else{
					res.status(200).json({'message':'Funcionario modificado exitosamente.','code':0});
					sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/updatefuncionario','" + req.user[0].id_usuario + "','" + dformat + "','Usuario modificó modificó funcionario con identificacion: " + identificacion + "');"								
					dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Funcionario modificado")})
				}
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /crearfuncionariokiosco Asociar Funcionario a quiosco
       * @apiName Asociar Funcionario a quiosco
       * @apiGroup Parametros
       *
       * @apiParam {String} cajero Serial del quiosco.
	   * @apiParam {Integer} pais Id del pais al que se quiere asociar el funcionario.
	   * @apiParam {Integer} ciudad Id de la ciudad a la que se quiere asociar el funcionario
	   * @apiParam {JSON} entidades Entidades asociadas al usuario.
	   * @apiParam {JSON} administradores Administradores asociados al usuario.
	   * @apiParam {Integer} usuario Cédula del usuario que se quiere asociar.
       *
       * @apiSuccess {JSON} JSON Información de la asociación del funcionario a el/los quioscos.
    */

	app.post('/crearfuncionariokiosco',(req, res) => {
		if(req.isAuthenticated()){
			console.log("Entra");
			var administradores = req.body.administradores,
			cajero = req.body.cajero,
			pais = req.body.pais,
			ciudad = req.body.ciudad,
			entidades = req.body.entidades,
			usuario = req.body.usuario,

			entidadesF = entidades.length > 0 ? entidades.join(',') : '',
			administradoresF = administradores.length > 0 ? administradores.join(',') : '';

			var sql = "insert into usuario_por_kiosko (SELECT '" + usuario + "'as id_usuario_kiosko, " + 
			"id_cajero,1 as id_horario, 0 as crear_en_kiosko,0 as borrar_en_kiosko " + 
			"FROM cajero C " + 
			"LEFT JOIN geografia AS G ON C.id_geografia = G.id_geografia " + 
			"WHERE 1 AND " + 
			"NOT EXISTS (select * from usuario_por_kiosko U where 1 and  C.id_cajero = U.id_cajero and id_usuario_kiosko = '" + usuario + "') " + 
			(entidadesF !== '' ? "AND C.id_entidad IN(" + entidadesF + ") " : '') + 
			(administradoresF !== '' ? "AND C.id_administrador IN(" + administradoresF + ") ": '') + 
			(pais !== null && pais != '' && pais !== undefined ? "AND G.Id_geografia_padre = '" + pais + "' ": '') + 
			(ciudad !== '' && ciudad !== null && ciudad !== undefined ? "AND G.Id_geografia = '" + ciudad + "' ": '') + 
			(cajero !== null && cajero != '' && cajero !== undefined ? "AND C.Id_cajero = '" + cajero + "' ": '') + 
			")";
			//
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error creando usuario para quiosco.', code:1});
				}
				else {
					sql = "UPDATE usuario_por_kiosko SET crear_en_kiosko = '1', borrar_en_kiosko = '0' " +
					"WHERE id_usuario_kiosko = '" + usuario + "' AND " + 
					"id_cajero in (SELECT  id_cajero FROM (SELECT C.id_cajero FROM usuario_por_kiosko U, " + 
					"cajero C LEFT JOIN geografia AS G ON C.id_geografia = G.id_geografia " + 
					"WHERE 1 AND U.Id_cajero = C.Id_cajero " + 
					(entidadesF !== '' ? "AND C.id_entidad IN(" + entidadesF + ") " : '') + 
					(administradoresF !== '' ? "AND C.id_administrador IN(" + administradoresF + ") ": '') + 
					(pais !== null && pais != '' && pais !== undefined ? "AND G.Id_geografia_padre = '" + pais + "' ": '') + 
					(ciudad != '' && ciudad !== null && ciudad !== undefined ? "AND G.Id_geografia = '" + ciudad + "' ": '') + 
					(cajero !== null && cajero != '' && cajero !== undefined ? "AND C.Id_cajero = '" + cajero + "' ": '') +
					") AS tabla1);";
					dbConnection.query(sql, (err, result) => {
						if(err) {
							console.log(err);
							res.status(400).json({'message':'Error creando usuario para quiosco.', code:1});
						}
						else {
							res.status(200).json({'message':'Usuario en quiosco creado', code:0, result:result});
						}
					})
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
		
	})

	/**
       * @api {post} /borrarfuncionariokiosco Desasociar Funcionario a quiosco
       * @apiName Desasociar Funcionario a quiosco
       * @apiGroup Parametros
       *
       * @apiParam {String} cajero Serial del quiosco.
	   * @apiParam {Integer} pais Id del pais al que se quiere asociar el funcionario.
	   * @apiParam {Integer} ciudad Id de la ciudad a la que se quiere asociar el funcionario
	   * @apiParam {JSON} entidades Entidades asociadas al usuario.
	   * @apiParam {JSON} administradores Administradores asociados al usuario.
	   * @apiParam {Integer} usuario Cédula del usuario que se quiere asociar.
       *
       * @apiSuccess {JSON} JSON Información de la asociación del funcionario a el/los quioscos.
    */

	app.post('/borrarfuncionariokiosco',(req, res) => {
		if(req.isAuthenticated()){
			console.log("Entra");
			var administradores = req.body.administradores,
			cajero = req.body.cajero,
			pais = req.body.pais,
			ciudad = req.body.ciudad,
			entidades = req.body.entidades,
			usuario = req.body.usuario,
			entidadesF = entidades.length > 0 ? entidades.join(',') : '',
			administradoresF = administradores.length > 0 ? administradores.join(',') : '';

			var sql = "UPDATE usuario_por_kiosko SET crear_en_kiosko = '0', borrar_en_kiosko = '1' " +
			"WHERE id_usuario_kiosko = '" + usuario + "' AND " + 
			"id_cajero in (SELECT  id_cajero FROM (SELECT C.id_cajero FROM usuario_por_kiosko U, " + 
			"cajero C LEFT JOIN geografia AS G ON C.id_geografia = G.id_geografia " + 
			"WHERE 1 AND U.Id_cajero = C.Id_cajero " + 
			(entidadesF !== '' ? "AND C.id_entidad IN(" + entidadesF + ") " : '') + 
			(administradoresF !== '' ? "AND C.id_administrador IN(" + administradoresF + ") ": '') + 
			(pais !== null && pais != '' && pais !== undefined ? "AND G.Id_geografia_padre = '" + pais + "' ": '') + 
			(ciudad != '' && ciudad !== null && ciudad !== undefined ? "AND G.Id_geografia = '" + ciudad + "' ": '') + 
			(cajero !== null && cajero != '' && cajero !== undefined ? "AND C.Id_cajero = '" + cajero + "' ": '') +
			") AS tabla1);";
			//			  
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error borrando usuario para quiosco.', code:1});
				}
				else {
					res.status(200).json({'message':'Usuario en quiosco borrado', code:0, result:result});
				}
			})
			
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
		
	})

	/**
       * @api {post} /userslist Lista de usuarios
       * @apiName Lista de usuarios
       * @apiGroup Parametros
       *
       *
       * @apiSuccess {JSON} JSON Lista de los usuarios registrados.
    */

	app.get('/userslist', (req, res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "SELECT id_usuario,identificacion_usuario, nombre, apellido1,apellido2,CONCAT (nombre,' ' ,Apellido1 ,' ', apellido2) as nombre_acu,email,id_entidad,id_administrador,estado,descripcion_estado,fecha_registro,fecha_renovacion_pwd,dias_vigencia_pwd,datos_contacto FROM `usuario` WHERE 1 " + userCompany + userAdmin + ";"
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error consultando la lista de usuarios', code:1});
				}
				else {
					res.status(200).json({'message':'Lista de usuarios', code:0, result:result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});


	/**
       * @api {post} /funcionarioslist Lista de funcionarios
       * @apiName Lista de funcionarios
       * @apiGroup Parametros
       *
       *
       * @apiSuccess {JSON} JSON Lista de los funcionarios creados.
    */
	app.get('/funcionarioslist', (req, res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "select id_usuario_kiosko,usuario_kiosko as email,U.nombre,id_entidad,id_administrador,T.nombre as tipo,estado,fecha_peticion FROM  usuario_kiosko U INNER JOIN tipo_usuario_kiosko T ON U.id_tipo_usuario_kiosko= T.id_tipo_usuario_kiosko WHERE 1 " + userCompany + userAdmin + ";";
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error consultando la lista de funcionarios', code:1});
				}
				else {
					res.status(200).json({'message':'Lista de funcionarios', code:0, result:result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.get('/eventoslist', (req, res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "SELECT * FROM tipo_evento WHERE id_rol LIKE '%" + req.user[0].rol_idrol + "%'";
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error consultando la lista de funcionarios', code:1});
				}
				else {
					res.status(200).json({'message':'Lista de eventos', code:0, result:result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.get('/eventoslistcompleto', (req, res) => {
		if(req.isAuthenticated()){
			var sql = "SELECT * "
				+ "FROM tipo_evento "
				+ "WHERE 1 ;";
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error consultando la lista de funcionarios', code:1});
				}
				else {
					res.status(200).json({'message':'Lista de eventos', code:0, result:result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.get('/comisioneslist', (req, res) => {
		if(req.isAuthenticated()){
			var sql = "SELECT * "
				+ "FROM comision "
				+ "WHERE 1 "
				+ (req.query.red !== undefined && req.query.red !== ''? "AND id_red = '" + req.query.red + "' ": ' ')
				+ (req.query.entidad !== undefined && req.query.entidad !== ''? "AND id_entidad = '" + req.query.entidad + "' ": ' ')
				+ (req.query.transaccion !== undefined && req.query.transaccion !== ''? "AND id_transaccion = '" + req.query.transaccion + "' ": ' ')
				+";";
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error consultando la lista de funcionarios', code:1});
				}
				else {
					res.status(200).json({'message':'Lista de eventos', code:0, result:result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.get('/eventoslist', (req, res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "SELECT * FROM tipo_evento WHERE id_rol LIKE '%" + req.user[0].rol_idrol + "%'";
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error consultando la lista de funcionarios', code:1});
				}
				else {
					res.status(200).json({'message':'Lista de eventos', code:0, result:result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.get('/eventoslistcompleto', (req, res) => {
		if(req.isAuthenticated()){
			var sql = "SELECT * "
				+ "FROM tipo_evento "
				+ "WHERE 1 ;";
			dbConnection.query(sql, (err, result) => {
				if(err) {
					console.log(err);
					res.status(400).json({'message':'Error consultando la lista de funcionarios', code:1});
				}
				else {
					res.status(200).json({'message':'Lista de eventos', code:0, result:result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	/**
       * @api {post} /agregarkiosco Crear quiosco
       * @apiName Crear quiosco
       * @apiGroup Parametros
       *
	   * @apiParam {String} id_cajero Id del quiosco.
	   * @apiParam {String} nombre Nombre del quiosco.
	   * @apiParam {Integer} id_entidad Id de la entidad dueña del quiosco.
	   * @apiParam {Integer} id_marca Id de la marca del quiosco.
	   * @apiParam {Integer} id_modelo Id del modelo del quiosco.
	   * @apiParam {String} serial Serial del quiosco.
	   * @apiParam {Integer} id_administrador Id del administrador del quiosco.
	   * @apiParam {String} direccion Dirección en la que se encuentra el quiosco.
	   * @apiParam {Float} latitud Latitud en la que se encuentra el quiosco.
	   * @apiParam {Float} longitud Longitud en la que se encuentra el quiosco.
	   * @apiParam {Integer} id_geografia Id de la ciudad en la que se encuentra el quiosco.
	   * @apiParam {Integer} gaveta1 Denominación de la gaveta 1.
	   * @apiParam {Integer} gaveta2 Denominación de la gaveta 2.
	   * @apiParam {Integer} gaveta3 Denominación de la gaveta 3.
	   * @apiParam {Integer} gaveta4 Denominación de la gaveta 4.
	   * @apiParam {Integer} gaveta5 Denominación de la gaveta 5.
	   * @apiParam {Integer} gaveta6 Denominación de la gaveta 6.
       *
       * @apiSuccess {JSON} JSON Lista de los usuarios registrados.
    */
   	app.post('/agregarkiosko', (req,res) =>{
		if(req.isAuthenticated()){
			let id_cajero = req.body.id_cajero;
			var sql = "SELECT * FROM cajero WHERE id_cajero = '" + id_cajero + "'";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(400).json({'message':'Error insertando el kiosko en la base de datos.'});
				}
				else if(result.length === 0){
					let secretoDecrypt = req.body.secreto;
					encrypter.encrypt(secretoDecrypt, function(hash){
						let nombre = req.body.nombre;
						let id_entidad = req.body.id_entidad;
						let gaveta1 = req.body.gaveta1 == '' ? null: req.body.gaveta1;
						let gaveta2 = req.body.gaveta2 == '' ? null: req.body.gaveta2;
						let gaveta3 = req.body.gaveta3 == '' ? null: req.body.gaveta3;
						let gaveta4 = req.body.gaveta4 == '' ? null: req.body.gaveta4;
						let gaveta5 = req.body.gaveta5 == '' ? null: req.body.gaveta5;
						let gaveta6 = req.body.gaveta6 == '' ? null: req.body.gaveta6;
						let id_marca= req.body.id_marca;
						let id_modelo = req.body.id_modelo;
						let red = req.body.red;
						let serial = req.body.serial;
						let id_administrador = req.body.id_administrador;
						let direccion = req.body.direccion;
						let latitud = req.body.latitud;
						let longitud = req.body.longitud;
						let id_geografia = req.body.id_geografia;
						let sim = req.body.sim;
						let anydesk = req.body.anydesk;
						var id_sep = serial.split('');
						var secretofinal = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');

						var sql = "INSERT INTO cajero (id_cajero,id_entidad,nombre,id_denominacion_gav1,id_denominacion_gav2,id_denominacion_gav3,id_denominacion_gav4,id_denominacion_gav5,id_denominacion_gav6,id_marca,id_modelo,Serial,secreto,id_administrador,direccion,Latitud,Longitud,id_geografia, id_red, SIM, AnyDesk) " +
							"VALUES ('" + id_cajero + "','" + id_entidad + "','" + nombre + "'," + gaveta1 + "," + gaveta2 + "," + gaveta3 + "," + gaveta4 + "," + gaveta5 + "," + gaveta6 + ",'" +
							id_marca + "','" + id_modelo + "','" + serial + "','" + secretofinal + "'," + id_administrador + ",'" + direccion + "','" + latitud + "','" + longitud + "'," + id_geografia + ", " + red + ", '" + sim + "','" + anydesk + "')";
						dbConnection.query(sql, (err, result) =>{
						if(err) {
							console.log(err);
							res.status(400).json({'message':'Error insertando el kiosko en la base de datos.'});
						}
						else {
							res.status(200).json({'message':'Kiosko agregado exitosamente', 'code':2});
						}
						});
					});
				}
				else{
					res.status(400).json({'message':'Ya existe un kiosco con ese id de cajero.'});
				}
			})
		}	
		else{
		res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.post('/updatekiosko', (req,res) =>{
		if(req.isAuthenticated()){
			let id_cajero = req.body.id_cajero;
			var sql = "SELECT * FROM cajero WHERE id_cajero = '" + id_cajero + "'";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(400).json({'message':'Error insertando el kiosko en la base de datos.'});
				}
				else if(result.length > 0){
					let nombre = req.body.nombre;
					let id_entidad = req.body.id_entidad;
					let gaveta1 = req.body.gaveta1 == '' ? null: req.body.gaveta1;
					let gaveta2 = req.body.gaveta2 == '' ? null: req.body.gaveta2;
					let gaveta3 = req.body.gaveta3 == '' ? null: req.body.gaveta3;
					let gaveta4 = req.body.gaveta4 == '' ? null: req.body.gaveta4;
					let gaveta5 = req.body.gaveta5 == '' ? null: req.body.gaveta5;
					let gaveta6 = req.body.gaveta6 == '' ? null: req.body.gaveta6;
					let id_marca= req.body.id_marca;
					let id_modelo = req.body.id_modelo;
					let serial = req.body.serial;
					let red = req.body.red;
					let id_administrador = req.body.id_administrador;
					let direccion = req.body.direccion;
					let latitud = req.body.latitud;
					let longitud = req.body.longitud;
					let id_geografia = req.body.id_geografia;
					let sim = req.body.sim;
					let anydesk = req.body.anydesk;
					var sql = "UPDATE cajero SET id_cajero = '" + id_cajero + "',id_entidad = '" + id_entidad + "'," + 
						"nombre = '" + nombre + "',id_denominacion_gav1 = " + gaveta1 + ",id_denominacion_gav2 = " + gaveta2 + ", " + 
						"id_denominacion_gav3 = " + gaveta3 + ",id_denominacion_gav4 = " + gaveta4 + ", " +
						"id_denominacion_gav5 = " + gaveta5 + ",id_denominacion_gav6 = " + gaveta6 + ", " +
						"id_marca = '" + id_marca + "',id_modelo = '" + id_modelo + "',Serial = '" + serial + "', " + 
						"id_administrador = '" + id_administrador + "',direccion = '" + direccion + "', " + 
						"Latitud = '" + latitud + "',Longitud = '" + longitud + "',id_geografia = " + id_geografia + ", id_red = " + red + ", SIM = '" + sim + "', AnyDesk = '" + anydesk + "' WHERE id_cajero = " + id_cajero + " ";
					//
					dbConnection.query(sql, (err, result) =>{
						if(err) {
							console.log(err);
							res.status(400).json({'message':'Error insertando el kiosko en la base de datos.'});
						}
						else {
							res.status(200).json({'message':'Kiosko actualizado exitosamente.','code':2});
						}
					});
				}
				else{
					res.status(400).json({'message':'No se encontro ese quiosco con el id proporcionado.'});
				}
			})
		}	
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.post('/cambiarSecreto', (req,res) => {
		secretoDecrypted = req.body.secreto;
		serial = req.body.serial;
		encrypter.encrypt(secretoDecrypted, (hash) => {
			var id_sep = serial.split('');
			var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
			var sql = "UPDATE cajero SET secreto = '" + final + "' WHERE Serial = '" + serial +"';";
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else{
				res.status(200).json({
					success: true,
					message: 'Secret updated',
				});
				}
			})
		})
	})

	app.get('/adminKiosks', (req,res) => {
		if(req.isAuthenticated()){
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
		var sql = "SELECT id_cajero, nombre_cajero, nombre_entidad, direccion, ciudad, Serial FROM((SELECT * FROM ( " +
		"(SELECT id_cajero, id_entidad, nombre AS nombre_cajero, direccion, id_geografia, id_administrador, Serial FROM cajero WHERE 1 AND activo = 1 " + userCompany + " " + userAdmin + ")  AS t1 " +
		"INNER JOIN " +
		"(SELECT id_entidad AS idt2, nombre AS nombre_entidad FROM entidad) AS t2 " +
		"ON t1.id_entidad = t2.idt2)) AS t3 " +
		"INNER JOIN " +
		"(SELECT id_geografia AS idgeo, nombre AS ciudad FROM geografia) AS t4 " +
		"ON t3.id_geografia = t4.idgeo)";
		console.log(sql);
		dbConnection.query(sql, (err, result) => {
			if(err){
			console.log(err);
			res.status(400).json({'message':'Error consultado la base de datos.'});
			}
			else{
				//console.log(result.length);
				res.status(200).json({'data':result});
			}
		})
		}
		else{
		res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /horas Movimientos en el día
       * @apiName Movimientos en el día
       * @apiGroup Movimientos
       *
	   * @apiParam {String} fecha Fecha de la consulta.
	   * @apiParam {Integer} transaccion Tipo de transacción.
	   * @apiParam {Integer} resultado Tipo de resultado de la transacciones.
	   * @apiParam {Integer} autorizador Id del autorizador.
	   * @apiParam {Integer} cajero Id del quiosco.
	   * @apiParam {Integer} pais Id del pais.
	   * @apiParam {Integer} ciudad Id de la ciudad.
       *
       * @apiSuccess {JSON} JSON Movimientos en el día.
    */

	app.get('/horas', (req,res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')) :fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var sql = "SELECT HOUR( FECHA_PETICION) AS HORA, COUNT( * ) as cantidad , SUM( VALOR_TX ) AS VALOR,"+
			"SUM( VALOR_COMISION ) AS COMISION,"+
			"CASE T.ENTRADA_SALIDA "+
			"WHEN 1 THEN 'CASH IN' "+
			"WHEN 2 THEN 'CASH OUT' "+
			"WHEN 3 THEN 'IN/OUT' "+
			"END AS ENTRADA_SALIDA "+
			"FROM `movimiento_" + fecha.getFullYear() + mes + "` M, `tipo_transaccion` T, `geografia` G,`cajero` C "+
			"WHERE M.ID_TIPO_TRANSACCION = T.ID_TIPO_TRANSACCION "+
			"AND M.id_cajero = C.id_cajero "+
			"AND C.Id_geografia = G.Id_geografia "+
			"AND fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND substring(cruce,1,1) = 1 "+
			(req.query.transaccion !== undefined? "And M.Id_tipo_transaccion = " +req.query.transaccion : "") + " " +
			(req.query.resultado !== undefined? "And M.id_tipo_resultado_tlf = " +req.query.resultado : "") + " " +
			(req.query.autorizador !== undefined? "And M.id_entidad_autorizadora = " +req.query.autorizador : "") + " " +
			(req.query.cajero !== undefined? "And M.id_cajero = " +req.query.cajero  : "") + " " +
			(req.query.pais !== undefined? "AND G.Id_geografia_padre = " +req.query.pais  : "") + " " +
			(req.query.ciudad !== undefined? "AND G.Id_geografia = " +req.query.ciudad  : "") + " " +
			userCompany + " " + userAdmin + " " +
			"GROUP BY HORA,T.ENTRADA_SALIDA "+
			"Order by HORA;";
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else{
				res.status(200).json({'result':result});
				}
			})
		}
		else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	/**
       * @api {post} /mes Movimientos en el mes
       * @apiName Movimientos en el mes
       * @apiGroup Movimientos
       *
	   * @apiParam {String} fecha Fecha de la consulta.
	   * @apiParam {Integer} transaccion Tipo de transacción.
	   * @apiParam {Integer} resultado Tipo de resultado de la transacciones.
	   * @apiParam {Integer} autorizador Id del autorizador.
	   * @apiParam {Integer} cajero Id del quiosco.
	   * @apiParam {Integer} pais Id del pais.
	   * @apiParam {Integer} ciudad Id de la ciudad.
       *
       * @apiSuccess {JSON} JSON Movimientos en el mes.
    */
	app.get('/mes', (req,res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND V.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
		var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
		var mesSep = ("00" + (fecha.getMonth()+1)).split('');
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
		var sql = "SELECT fecha_negocio AS fecha, sum( cantidad ) as cantidad , SUM( VALOR_TX ) AS VALOR, " +
		"SUM( VALOR_COMISION ) AS COMISION, " +
		"CASE T.ENTRADA_SALIDA " +
		"WHEN 1 THEN 'CASH IN' " +
		"WHEN 2 THEN 'CASH OUT' " +
		"WHEN 3 THEN 'IN/OUT' " +
		"END AS ENTRADA_SALIDA " +
		"FROM `View_" + fecha.getFullYear() +  mes + "` V, `tipo_transaccion` T, `geografia` G, `cajero` C, `tipo_resultado` R " +
		"WHERE V.Id_tipo_transaccion = T.id_tipo_transaccion " +
		"AND V.id_cajero = C.id_cajero " +
		"AND C.Id_geografia = G.Id_geografia " +
		"And V.Id_Tipo_Resultado_tlf = R.id_tipo_resultado " +
		"AND month(fecha_negocio) = " + (fecha.getMonth()+1) + " and year(fecha_negocio) = " + fecha.getFullYear() +
		(req.query.transaccion !== undefined? "And V.Id_tipo_transaccion = " +req.query.transaccion : "") + " " +
		(req.query.resultado !== undefined? "And V.id_tipo_resultado_tlf = " +req.query.resultado : "") + " " +
		(req.query.autorizador !== undefined? "And V.id_entidad_autorizadora = " +req.query.autorizador : "") + " " +
		(req.query.cajero !== undefined? "And V.id_cajero = " +req.query.cajero  : "") + " " +
		(req.query.pais !== undefined? "AND G.Id_geografia_padre = " +req.query.pais  : "") + " " +
		(req.query.ciudad !== undefined? "AND G.Id_geografia = " +req.query.ciudad  : "") + " " +
		userCompany + " " + userAdmin + " " + 
		"GROUP BY fecha,T.ENTRADA_SALIDA "+
		"ORDER BY Fecha;";
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else{
			res.status(200).json({'result':result});
			}
		});
		}
		else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	});
	
	/**
       * @api {post} /horas Movimientos en el anho
       * @apiName Movimientos en el anho
       * @apiGroup Movimientos
       *
	   * @apiParam {String} fecha Fecha de la consulta.
	   * @apiParam {Integer} transaccion Tipo de transacción.
	   * @apiParam {Integer} resultado Tipo de resultado de la transacciones.
	   * @apiParam {Integer} autorizador Id del autorizador.
	   * @apiParam {Integer} cajero Id del quiosco.
	   * @apiParam {Integer} pais Id del pais.
	   * @apiParam {Integer} ciudad Id de la ciudad.
       *
       * @apiSuccess {JSON} JSON Movimientos en el anho.
    */

	app.get('/anio', (req,res) => {
		if(req.isAuthenticated()){
		var fecha = fechaActual();
		var mesSep = ("00" + (fecha.getMonth()+1)).split('');
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
		var sql = "SELECT year(fecha_negocio) as anio, month(fecha_negocio) AS mes, COUNT( * ) as Cantidad, SUM( VALOR_TX ) AS VALOR, SUM( VALOR_COMISION ) AS COMISION,"+
		"CASE T.ENTRADA_SALIDA "+
		"WHEN 1 THEN 'CASH IN' "+
		"WHEN 2 THEN 'CASH OUT' "+
		"WHEN 3 THEN 'IN/OUT' "+
		"END AS ENTRADA_SALIDA "+
		"FROM `View_" + fecha.getFullYear() + mes + "` V, `tipo_transaccion` T "+
		"WHERE V.ID_TIPO_TRANSACCION = T.ID_TIPO_TRANSACCION "+
		"AND year(fecha_negocio) = " + fecha.getFullYear() + " "+ 
		userCompany + " " + userAdmin + " " + 
		"GROUP BY anio, mes,T.ENTRADA_SALIDA "+
		"ORDER BY anio, mes;"
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else{
			res.status(200).json({'result':result});
			}
		});
		}
		else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	/**
       * @api {post} /efectivoCajero Efectivo en el quiosco
       * @apiName Efectivo en el quiosco
       * @apiGroup Quiosco
       *
       * @apiSuccess {JSON} JSON Efectivo en los quioscos.
    */

	app.get('/efectivoCajeros', (req,res) => {
		if(req.isAuthenticated()){
		var fecha = fechaActual();
		var mesSep = ("00" + (fecha.getMonth()+1)).split('');
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
		var sql = "SELECT COUNT( * ) as cantidad , SUM( VALOR_TX ) AS VALOR "+
		"FROM `movimiento_" + fecha.getFullYear() + mes + "` M, `tipo_transaccion` T "+
		"WHERE M.ID_TIPO_TRANSACCION = T.ID_TIPO_TRANSACCION AND T.ENTRADA_SALIDA = 1 "+
		"AND M.FECHA_RETIRO_VALORES IS NULL;"
		dbConnection.query(sql, function(err, result){
		if(err) console.log(err);
		else{
		res.status(200).json({'result':result});
		}
		})
	}
	else{
		res.status(200).json({code:1,'message':'Auth required.'});

	}
	})

	/**
       * @api {post} /aprobadasrechazadasDia Aprobadas Rechazad Dia
       * @apiName Aprobadas Rechazadas Dia
       * @apiGroup Movimientos
       *
	   * @apiParam {Integer} transaccion Tipo de transacción.
	   * @apiParam {Integer} resultado Tipo de resultado de la transacciones.
	   * @apiParam {Integer} autorizador Id del autorizador.
	   * @apiParam {Integer} cajero Id del quiosco.
	   * 
       * @apiSuccess {JSON} JSON Aprobadas/Rechazadas en el día.
    */

   	app.get('/aprobadasrechazadasDia', (req,res) =>{
		if(req.isAuthenticated()){
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var sql = "SELECT HOUR( FECHA_PETICION) AS HORA, COUNT( * ) as cantidad , SUM( VALOR_TX ) AS VALOR, "+
			"SUM( VALOR_COMISION ) AS COMISION, "+
			"CASE M.ID_TIPO_RESULTADO_TLF "+
			"WHEN 0 THEN 'APROBADA' ELSE 'RECHAZADA' "+
			userCompany + ' ' + userAdmin + " " + 
			"END AS Resultado "+
			"FROM `movimiento_" + fecha.getFullYear() + mes + "` M, `tipo_transaccion` T, `geografia` G,`cajero` C, `tipo_resultado` R "+
			"WHERE M.ID_TIPO_TRANSACCION = T.ID_TIPO_TRANSACCION "+
			"AND M.id_cajero = C.id_cajero "+
			"AND C.Id_geografia = G.Id_geografia "+
			"And M.Id_Tipo_Resultado_tlf = R.id_tipo_resultado "+
			"AND fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND substring(cruce,1,1)= 1 "+
			(req.query.transaccion !== undefined? "And M.Id_tipo_transaccion = " +req.query.transaccion : "") + " " +
			(req.query.resultado !== undefined? "And M.id_tipo_resultado_tlf = " +req.query.resultado : "") + " " +
			(req.query.autorizador !== undefined? "And M.id_entidad_autorizadora = " +req.query.autorizador : "") + " " +
			(req.query.cajero !== undefined? "And M.id_cajero = " +req.query.cajero  : "") + " " +
			"GROUP BY HORA, Resultado "+
			"Order by HORA ";
			dbConnection.query(sql, function(err,result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /aprobadasrechazadasDia Aprobadas Rechazad Mes
       * @apiName Aprobadas Rechazadas Mes
       * @apiGroup Movimientos
       *
	   * @apiParam {Integer} transaccion Tipo de transacción.
	   * @apiParam {Integer} resultado Tipo de resultado de la transacciones.
	   * @apiParam {Integer} autorizador Id del autorizador.
	   * @apiParam {Integer} cajero Id del quiosco.
	   * 
       * @apiSuccess {JSON} JSON Aprobadas/Rechazadas en el mes.
    */
    app.get('/aprobadasrechazadasMes', (req,res) =>{
		if(req.isAuthenticated()){
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "SELECT fecha_negocio AS fecha, sum( cantidad ) as cantidad , SUM( VALOR_TX ) AS VALOR, "+
			"SUM( VALOR_COMISION ) AS COMISION, "+
			"CASE V.ID_TIPO_RESULTADO_TLF "+
			"WHEN 0 THEN 'APROBADA' ELSE 'RECHAZADA' "+
			"END AS Resultado "+
			"FROM `View_" + fecha.getFullYear() + mes + "` V, `tipo_transaccion` T, `geografia` G,`cajero` C, `tipo_resultado` R "+
			"WHERE V.ID_TIPO_TRANSACCION = T.ID_TIPO_TRANSACCION "+
			userCompany + " " + userAdmin + " " +
			"AND V.id_cajero = C.id_cajero "+
			"AND C.Id_geografia = G.Id_geografia "+
			"And V.Id_Tipo_Resultado_tlf = R.id_tipo_resultado "+
			(req.query.transaccion !== undefined? "And V.Id_tipo_transaccion = " +req.query.transaccion : "") + " " +
			(req.query.autorizador !== undefined? "And V.id_entidad_autorizadora = " +req.query.autorizador : "") + " " +
			(req.query.cajero !== undefined? "And V.id_cajero = " +req.query.cajero  : "") + " " +
			"GROUP BY fecha, resultado "+
			"Order by fecha, resultado ";
			dbConnection.query(sql, function(err,result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/transaccionesRedDia', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var sql  = "SELECT R.nombre as red,count(*),sum(valor_tx),sum(valor_comision) FROM iprocessi.movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN red AS R ON cajero.id_red = R.id_red " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE 1 " +
			"AND fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND T.entrada_salida = 1  " +
			"AND substring(M.cruce,1,1) = 1  " +
			(req.query.cajero !== undefined? "And M.id_cajero = " +req.query.cajero  : "") + " " +
			"Group by red";
			//
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/transaccionesRedMes', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var sql  = "SELECT R.nombre as red,count(*),sum(valor_tx),sum(valor_comision) FROM iprocessi.movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN red AS R ON cajero.id_red = R.id_red " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE 1 " +
			"AND T.entrada_salida = 1  " +
			"AND substring(M.cruce,1,1) = 1  " +
			(req.query.cajero !== undefined? "And M.id_cajero = " +req.query.cajero  : "") + " " +
			"Group by red";
			//
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/transaccionesEntidadDia', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var sql  = "SELECT E.nombre as entidad,count(*),sum(valor_tx),sum(valor_comision) FROM iprocessi.movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN entidad AS E ON M.id_entidad_autorizadora = E.id_entidad " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE 1 " +
			"AND fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND T.entrada_salida = 1  " +
			"AND substring(M.cruce,1,1) = 1  " +
			(req.query.cajero !== undefined? "And M.id_cajero = " +req.query.cajero  : "") + " " +
			"Group by entidad";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/transaccionesEntidadMes', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var sql  = "SELECT E.nombre as red,count(*),sum(valor_tx),sum(valor_comision) FROM iprocessi.movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN entidad AS E ON M.id_entidad_autorizadora = E.id_entidad " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE 1 " +
			"AND T.entrada_salida = 1  " +
			"AND substring(M.cruce,1,1) = 1  " +
			(req.query.cajero !== undefined? "And M.id_cajero = " +req.query.cajero  : "") + " " +
			"Group by red";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/top30mesASC', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql  = "select cajero.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"RIGHT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE T.entrada_salida = 1 " + userCompany + 
			"AND substring(M.cruce,1,1) = 1 " +
			"group by cajero.nombre order by cantidad asc " +
			"limit 30;";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/top30diaASC', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql  = "select cajero.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"RIGHT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE T.entrada_salida = 1 " + userCompany + 
			"AND fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND substring(M.cruce,1,1) = 1 " +
			"group by cajero.nombre order by cantidad asc " +
			"limit 30;";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/top30mesDESC', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql  = "select cajero.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE T.entrada_salida = 1 " + userCompany + 
			"AND substring(M.cruce,1,1) = 1 " +
			"group by cajero.nombre order by cantidad desc " +
			"limit 30;";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/top30diaDESC', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			
			var sql  = "select cajero.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion " +
			"WHERE T.entrada_salida = 1 " + userCompany +
			"AND fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND substring(M.cruce,1,1) = 1 " +
			"group by cajero.nombre order by cantidad desc " +
			"limit 30;";
			console.log(sql);
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/txciudaddia', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			
			var sql  = "select G.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion  " +
			"LEFT JOIN geografia AS G ON cajero.id_geografia = G.id_geografia " +
			"WHERE T.entrada_salida = 1  " + userCompany + 
			(req.query.pais!== undefined? "AND G.id_geografia_padre = '" + req.query.pais + "'": "" ) + " " + //Blanco
			"AND M.fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND substring(M.cruce,1,1) = 1  " +
			"group by G.nombre order by cantidad desc";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/txciudadmes', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			
			var sql  = "select G.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion  " +
			"LEFT JOIN geografia AS G ON cajero.id_geografia = G.id_geografia " +
			"WHERE T.entrada_salida = 1  " + userCompany + 
			(req.query.pais!== undefined? "AND G.id_geografia_padre = '" + req.query.pais + "'": "" ) + " " + //Blanco
			"AND substring(M.cruce,1,1) = 1  " +
			"group by G.nombre order by cantidad desc";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/txpaisdia', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			
			var sql  = "select P.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion  " +
			"LEFT JOIN geografia AS G ON cajero.id_geografia = G.id_geografia " +
			"LEFT JOIN geografia AS P ON P.id_geografia = G.id_geografia_padre " +
			"WHERE T.entrada_salida = 1  " + userCompany + 
			"AND M.fecha_negocio = '" + fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" +fecha.getDate() + "' "+
			"AND substring(M.cruce,1,1) = 1  " +
			"group by P.nombre order by cantidad desc";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/txpaismes', (req, res) => {
		if(req.isAuthenticated()){	
			var fecha = req.query.fecha !== undefined? new Date(req.query.fecha.split('-').join('/')):fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1]
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			
			var sql  = "select P.nombre,sum(valor_comision) as comision, sum(valor_tx) as valor,count(*) as cantidad " +
			"from movimiento_" + fecha.getFullYear() + "" + mes + " M " +
			"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " +
			"LEFT JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion  " +
			"LEFT JOIN geografia AS G ON cajero.id_geografia = G.id_geografia " +
			"LEFT JOIN geografia AS P ON P.id_geografia = G.id_geografia_padre " +
			"WHERE T.entrada_salida = 1  " + userCompany
			"AND substring(M.cruce,1,1) = 1  " +
			"group by P.nombre order by cantidad desc";
			dbConnection.query(sql, (err,result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /movimientos Movimientos
       * @apiName Movimientos
       * @apiGroup Movimientos
       *
	   * @apiParam {String} fecha_inicial Fecha inicial de la consulta.
	   * @apiParam {String} fecha_final Fecha final de la consulta.
	   * @apiParam {Integer} id_cajero Id del quiosco.
	   * @apiParam {Integer} tipo_transaccion Id del tipo de las transacciones.
	   * @apiParam {Integer} id_geografia_padre Id del pais a consultar.
	   * @apiParam {Integer} id_geografia Id de la ciudad a consultar.
	   * @apiParam {Integer} id_red Id de la red a consultar.
	   * @apiParam {Float} valor_tx Valor de las transacciones a consultar.
	   * @apiParam {String} ref_recaudo Cedula del usuario de la transacción.
	   * @apiParam {Integer} autorizacion Número de la autorización.
	   * 
       * @apiSuccess {JSON} JSON Movimientos de a consulta.
    */

	app.get('/movimientos', function(req, res){
		if(req.isAuthenticated()){
			var d = fechaActual(),
		dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			 d.getMinutes().padLeft(),
						   d.getSeconds().padLeft()].join(':');
			sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/movimientos','" + req.user[0].id_usuario + "','" + dformat + "','Usuario consultó movimientos');";
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Usuario consultó movimientos: " + id_usuario)})
		//console.log(req.query.fecha_inicial);
		var fecha_inicial = req.query.fecha_inicial !== undefined ? new Date(req.query.fecha_inicial.split('-').join('/')) : fechaActual(), formatInicial = [fecha_inicial.getFullYear(),(fecha_inicial.getMonth()+1).padLeft(),
			fecha_inicial.getDate().padLeft(),
			].join('-')
		fecha_final = req.query.fecha_final !== undefined ? new Date(req.query.fecha_final.split('-').join('/')): fechaActual(), formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-'); 
		var mesSep = ("000" + (fecha_inicial.getMonth()+1)).split('');
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND cajero.id_administrador IN(" + req.user[0].id_administrador + ")";
		var page = req.query.page,
		cantidad = req.query.cantidad !== '' && req.query.cantidad !== undefined && req.query.page !== null? req.query.cantidad : 100,
		limit = page !== null && page !== undefined && page !== '' ?  "LIMIT " + ((page-1)*cantidad) + "," + cantidad + ";":';'
		var sql = "SELECT " + 
		"id_movimiento,fecha_negocio, fecha_autorizacion," +
		"fecha_certificacion_tdv, " +   
		"fecha_retiro_valores, " +  
		"fecha_peticion as fecha,  " + 
		"R.nombre as red, " + 
		"M.id_cajero, " + 
		"M.num_factura, " +
		"cajero.nombre as kiosko, " + 
		"M.id_tipo_transaccion, " + 
		"T.nombre as transaccion, " + 
		"T.entrada_salida, " + 
		"valor_tx,secuencia,  " + 
		"id_entidad_recaudo, " + 
		"REC.nombre as entidad, " + 
		"ref_recaudo, " +
		"autorizacion, " +
		"valor_comision, " +   
		"id_tipo_resultado_aut as resultado_aut, " + 
		"id_tipo_resultado_tlf as resultado, " + 
		"id_entidad_adquiriente, " + 
		"ADQ.nombre as adquiriente, " + 
		"id_entidad_autorizadora, " + 
		"AUT.nombre as autorizadora, " + 
		"G.nombre as geografia, " + 
		"cruce, " + 
		"billete_in, " + 
		"moneda_in, " + 
		"billete_out, " + 
		"moneda_out, " + 
		"id_tipo_resultado_aut, " + 
		"id_tipo_resultado_tira, " +
		"M.reg_unico " + 
		"FROM movimiento_" + fecha_inicial.getFullYear() + "" + mes + " M " + 
		"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " + 
		"LEFT JOIN geografia AS G ON cajero.id_geografia = G.id_geografia " + 
		"LEFT JOIN red AS R ON cajero.id_red = R.id_red " + 
		"LEFT JOIN tipo_transaccion AS T ON M.id_tipo_transaccion = T.id_tipo_transaccion " + 
		"LEFT JOIN entidad as REC ON M.id_entidad_recaudo = REC.id_entidad " + 
		"LEFT JOIN entidad as AUT ON M.id_entidad_autorizadora = AUT.id_entidad " + 
		"LEFT JOIN entidad as ADQ ON M.id_entidad_adquiriente = ADQ.id_entidad " + 
		"WHERE 1 " +
		userCompany + " " + userAdmin + " " + 
		(req.query.fecha_inicial !== undefined? "AND fecha_peticion >='" + req.query.fecha_inicial + " " + (req.query.horaInicial !== undefined ? req.query.horaInicial + ":00" : "00:00:00") + "'" : "AND fecha_negocio >='" + formatInicial + "'") +  " " + //La de hoy por defecto
		(req.query.fecha_final !== undefined? "AND fecha_peticion <= '" + req.query.fecha_final + " " + (req.query.horaFinal !== undefined ? req.query.horaFinal + ":59" : "23:59:59") + "'" : "AND fecha_negocio <='" + formatFinal + "'") + " " + //La de hoy por defecto
		(req.query.id_cajero!== undefined? "AND M.Id_Cajero = '" + req.query.id_cajero + "'" : "" ) + " " + //Blanco
		(req.query.tipo_transaccion!== undefined? "AND T.id_tipo_transaccion = '" + req.query.tipo_transaccion + "'" : "" ) + " " + //Blanco
		(req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" ) + " " + //Blanco
		(req.query.id_geografia!== undefined? "AND G.id_geografia = '" + req.query.id_geografia + "'": "" ) + " "  + //Blanco
		(req.query.id_red!== undefined? "AND R.id_red = '" + req.query.id_red + "'": "" ) + " "  + //Blanco
		(req.query.valor_tx!== undefined? "AND valor_tx = " + req.query.valor_tx: "" ) + " "  + //Blanco
		(req.query.ref_recaudo!== undefined? "AND ref_recaudo = '" + req.query.ref_recaudo + "'": "" ) + " "  + //Blanco
		(req.query.autorizacion!== undefined? "AND autorizacion = '" + req.query.autorizacion + "'": "" ) + " "  + //Blanco
		(req.query.entidad!== undefined? "AND id_entidad_autorizadora = '" + req.query.entidad + "'": "" ) + " "  + //Blanco
		"ORDER BY fecha_peticion DESC " + limit;
		console.log(sql);
		console.log(req.query);
		dbConnection.query(sql, (err, result) => {
			if(err){
			console.log(err);
			}
			else{
				res.status(200).json({'result':result});
				//console.log(result.length);
			} 
		})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/totalmovim', (req, res) => {
		if(req.isAuthenticated()){
			var d = fechaActual(),
		dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			d.getMinutes().padLeft(),
			d.getSeconds().padLeft()].join(':');
		//console.log(req.query.fecha_inicial);
		var fecha_inicial = req.query.fecha_inicial !== undefined && !isNaN(new Date(req.query.fecha_inicial.split('-').join('/'))) ? new Date(req.query.fecha_inicial.split('-').join('/')) : fechaActual(), 
		formatInicial = [fecha_inicial.getFullYear(),(fecha_inicial.getMonth()+1).padLeft(),
			fecha_inicial.getDate().padLeft(),
			].join('-')
		fecha_final = req.query.fecha_final !== undefined && isNaN(new Date(req.query.fecha_final.split('-').join('/'))) ? new Date(req.query.fecha_final.split('-').join('/')): fechaActual(), formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-'); 
		var mesSep = ("000" + (fecha_inicial.getMonth()+1)).split('');
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND cajero.id_administrador IN(" + req.user[0].id_administrador + ")";
		var sql = "SELECT count(*) AS total " +  
		"FROM movimiento_" + fecha_inicial.getFullYear() + "" + mes + " M " + 
		"LEFT JOIN cajero ON M.id_cajero = cajero.id_cajero " + 
		"LEFT JOIN geografia AS G ON cajero.id_geografia = G.id_geografia " + 
		"LEFT JOIN red AS R ON cajero.id_red = R.id_red " + 
		"LEFT JOIN tipo_transaccion AS T ON M.id_tipo_transaccion = T.id_tipo_transaccion " + 
		"LEFT JOIN entidad as REC ON M.id_entidad_recaudo = REC.id_entidad " + 
		"LEFT JOIN entidad as AUT ON M.id_entidad_autorizadora = AUT.id_entidad " + 
		"LEFT JOIN entidad as ADQ ON M.id_entidad_adquiriente = ADQ.id_entidad " + 
		"WHERE 1 " +
		userCompany + " " + userAdmin + " " + 
		(req.query.fecha_inicial !== undefined? "AND fecha_peticion >='" + req.query.fecha_inicial + " " + (req.query.horaInicial !== undefined ? req.query.horaInicial + ":00" : "00:00:00") + "'" : "AND fecha_negocio >='" + formatInicial + "'") +  " " + //La de hoy por defecto
		(req.query.fecha_final !== undefined? "AND fecha_peticion <= '" + req.query.fecha_final + " " + (req.query.horaFinal !== undefined ? req.query.horaFinal + ":59" : "23:59:59") + "'" : "AND fecha_negocio <='" + formatFinal + "'") + " " + //La de hoy por defecto
		(req.query.id_cajero!== undefined? "AND M.Id_Cajero = '" + req.query.id_cajero + "'" : "" ) + " " + //Blanco
		(req.query.tipo_transaccion!== undefined? "AND T.id_tipo_transaccion = '" + req.query.tipo_transaccion + "'" : "" ) + " " + //Blanco
		(req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" ) + " " + //Blanco
		(req.query.id_geografia!== undefined? "AND G.id_geografia = '" + req.query.id_geografia + "'": "" ) + " "  + //Blanco
		(req.query.id_red!== undefined? "AND R.id_red = '" + req.query.id_red + "'": "" ) + " "  + //Blanco
		(req.query.valor_tx!== undefined? "AND valor_tx = " + req.query.valor_tx: "" ) + " "  + //Blanco
		(req.query.ref_recaudo!== undefined? "AND ref_recaudo = '" + req.query.ref_recaudo + "'": "" ) + " "  + //Blanco
		(req.query.autorizacion!== undefined? "AND autorizacion = '" + req.query.autorizacion + "'": "" ) + " "  + //Blanco
		(req.query.entidad!== undefined? "AND id_entidad_autorizadora = '" + req.query.entidad + "'": "" ) + " "  + //Blanco
		"ORDER BY fecha_peticion DESC";
		//
		dbConnection.query(sql, (err, result) => {
			if(err){
			console.log(err);
			}
			else{
				res.status(200).json({'total':result[0].total});
				//console.log(result.length);
			} 
		})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/actividadusuarios', (req, res) => {
		if(req.isAuthenticated()){

			var d = fechaActual(),
		dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			d.getMinutes().padLeft(),
			d.getSeconds().padLeft()].join(':');
		//console.log(req.query.fecha_inicial);
		var fecha_inicial = req.query.fecha_inicial !== undefined && !isNaN(new Date(req.query.fecha_inicial.split('-').join('/'))) ? new Date(req.query.fecha_inicial.split('-').join('/')) : fechaActual(), 
		formatInicial = [fecha_inicial.getFullYear(),(fecha_inicial.getMonth()+1).padLeft(),
			fecha_inicial.getDate().padLeft(),
			].join('-');
		fecha_final = req.query.fecha_final !== undefined && isNaN(new Date(req.query.fecha_final.split('-').join('/'))) ? new Date(req.query.fecha_final.split('-').join('/')): fechaActual(), formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-');
		formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-');

		var page = req.query.page,
		cantidad = req.query.cantidad !== '' && req.query.cantidad !== undefined && req.query.page !== null? req.query.cantidad : 100,
		limit = page !== null && page !== undefined && page !== '' ?  "LIMIT " + ((page-1)*cantidad) + "," + cantidad + ";":';';

		var sql = "SELECT t1.*, t2.nombre, t2.apellido1, t2.apellido2 FROM (SELECT * FROM registro_log WHERE 1 " + 
		(req.query.fecha_inicial !== undefined? " AND fecha_registro >='" + req.query.fecha_inicial + " 00:00:00'" : "AND fecha_registro >='" + formatInicial + " 00:00:00'") +
		(req.query.fecha_final !== undefined? " AND fecha_registro <='" + req.query.fecha_final + " 23:59:59'" : "AND fecha_registro <='" + formatFinal + " 23:59:59'") + 
		(req.query.id_usuario !== undefined? " AND id_usuario ='" + req.query.id_usuario + "'" : " ") +  
		") t1 INNER JOIN (SELECT * FROM usuario) t2 ON t1.id_usuario = t2.id_usuario ORDER BY fecha_registro " + limit;
		console.log(sql);
		dbConnection.query(sql, (err, result) => {
			if(err){
				console.log(err);
				res.status(200).json({code: 2, message: "Erro en la consulta."});
			}
			else{
				res.status(200).json({'total':result});

			}
		})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}

	})

	app.get('/totalActividadUsuario', (req, res) => {
		if(req.isAuthenticated()){

			var d = fechaActual(),
		dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			d.getMinutes().padLeft(),
			d.getSeconds().padLeft()].join(':');
		//console.log(req.query.fecha_inicial);
		var fecha_inicial = req.query.fecha_inicial !== undefined && !isNaN(new Date(req.query.fecha_inicial.split('-').join('/'))) ? new Date(req.query.fecha_inicial.split('-').join('/')) : fechaActual(), 
		formatInicial = [fecha_inicial.getFullYear(),(fecha_inicial.getMonth()+1).padLeft(),
			fecha_inicial.getDate().padLeft(),
			].join('-');
		fecha_final = req.query.fecha_final !== undefined && isNaN(new Date(req.query.fecha_final.split('-').join('/'))) ? new Date(req.query.fecha_final.split('-').join('/')): fechaActual(), formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-');
		formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-');

		var page = req.query.page,
		cantidad = req.query.cantidad !== '' && req.query.cantidad !== undefined && req.query.page !== null? req.query.cantidad : 100,
		limit = page !== null && page !== undefined && page !== '' ?  "LIMIT " + ((page-1)*cantidad) + "," + cantidad + ";":';';

		var sql = "SELECT count(*) as total FROM (SELECT * FROM registro_log WHERE 1 " + 
		(req.query.fecha_inicial !== undefined? " AND fecha_registro >='" + req.query.fecha_inicial + " 00:00:00'" : "AND fecha_registro >='" + formatInicial + " 00:00:00'") +
		(req.query.fecha_final !== undefined? " AND fecha_registro <='" + req.query.fecha_final + " 23:59:59'" : "AND fecha_registro <='" + formatFinal + " 23:59:59'") + 
		(req.query.id_usuario !== undefined? " AND id_usuario ='" + req.query.id_usuario : " ") +  
		") t1 INNER JOIN (SELECT * FROM usuario) t2 ON t1.id_usuario = t2.id_usuario ORDER BY t1.fecha_registro " + limit + ";";
		console.log(sql);
		dbConnection.query(sql, (err, result) => {
			if(err){
				res.status(200).json({code: 2, message: "Erro en la consulta."});
			}
			else{
				res.status(200).json({'total':result[0].total});

			}
		})

		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}

	})

	app.get('/movimientosDelivery', function(req, res){
		if(req.isAuthenticated()){
			var d = fechaActual(),
		dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			 d.getMinutes().padLeft(),
						   d.getSeconds().padLeft()].join(':');
			sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/movimientos','" + req.user[0].id_usuario + "','" + dformat + "','Usuario consultó movimientos');";
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Usuario consultó movimientos: " + id_usuario)})
		//console.log(req.query.fecha_inicial);
		var fecha_inicial = req.query.fecha_inicial !== undefined ? new Date(req.query.fecha_inicial.split('-').join('/')) : fechaActual(), formatInicial = [fecha_inicial.getFullYear(),(fecha_inicial.getMonth()+1).padLeft(),
			fecha_inicial.getDate().padLeft(),
			].join('-')
		fecha_final = req.query.fecha_final !== undefined ? new Date(req.query.fecha_final.split('-').join('/')): fechaActual(), formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-'); 
		var mesSep = ("000" + (fecha_inicial.getMonth()+1)).split('');
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
		var page = req.query.page,
		cantidad = req.query.cantidad !== '' && req.query.cantidad !== undefined && req.query.page !== null? req.query.cantidad : 100,
		limit = page !== null && page !== undefined && page !== '' ?  "LIMIT " + ((page-1)*cantidad) + "," + cantidad + ";":';'
		var sql = "SELECT " + 
		"fecha_peticion as fecha,  " +  
		"valor_tx,  " + 
		"ref_recaudo, " +
		"G.nombre as geografia, " +  
		"C.direccion, " +
		"CP.nombre " +  
		"FROM movimiento_" + fecha_inicial.getFullYear() + "" + mes + " M " + 
		"LEFT JOIN cajero AS C ON M.id_cajero = C.id_cajero " + 
		"LEFT JOIN geografia AS G ON C.id_geografia = G.id_geografia " + 
		"LEFT JOIN clientes_punto as CP ON CP.identificacion_extra = M.ref_recaudo " + 
		"WHERE 1  AND M.id_entidad_recaudo = 1009 " +
		userCompany + " " + userAdmin + " " + 
		(req.query.fecha_inicial !== undefined? "AND fecha_peticion >='" + req.query.fecha_inicial + " " + req.query.horaInicial + ":00'" : "AND fecha_peticion >='" + formatInicial + " 00:00:00'") +  " " + //La de hoy por defecto
		(req.query.fecha_final !== undefined? "AND fecha_peticion <= '" + req.query.fecha_final + " " + req.query.horaFinal + ":00'" : "AND fecha_peticion <='" + formatFinal + " 23:59:59'") + " " + //La de hoy por defecto
		(req.query.id_cajero!== undefined? "AND M.Id_Cajero = '" + req.query.id_cajero + "'" : "" ) + " " + //Blanco
		(req.query.tipo_transaccion!== undefined? "AND T.id_tipo_transaccion = '" + req.query.tipo_transaccion + "'" : "" ) + " " + //Blanco
		(req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" ) + " " + //Blanco
		(req.query.id_geografia!== undefined? "AND G.id_geografia = '" + req.query.id_geografia + "'": "" ) + " "  + //Blanco
		(req.query.valor_tx!== undefined? "AND valor_tx = " + req.query.valor_tx: "" ) + " "  + //Blanco
		(req.query.ref_recaudo!== undefined? "AND ref_recaudo = '" + req.query.ref_recaudo + "'": "" ) + " "  + //Blanco
		"ORDER BY fecha_peticion DESC " + limit;
		console.log(sql);
		dbConnection.query(sql, (err, result) => {
			if(err){
			console.log(err);
			}
			else{
				res.status(200).json({'result':result});
				//console.log(result.length);
			} 
		})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/totalmovimDelivery', (req, res) => {
		if(req.isAuthenticated()){
			var d = fechaActual(),
		dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			d.getMinutes().padLeft(),
			d.getSeconds().padLeft()].join(':');
		//console.log(req.query.fecha_inicial);
		var fecha_inicial = req.query.fecha_inicial !== undefined ? new Date(req.query.fecha_inicial.split('-').join('/')) : fechaActual(), formatInicial = [fecha_inicial.getFullYear(),(fecha_inicial.getMonth()+1).padLeft(),
			fecha_inicial.getDate().padLeft(),
			].join('-')
		fecha_final = req.query.fecha_final !== undefined ? new Date(req.query.fecha_final.split('-').join('/')): fechaActual(), formatFinal = [fecha_final.getFullYear(),(fecha_final.getMonth()+1).padLeft(),
			fecha_final.getDate().padLeft(),
			].join('-'); 
		var mesSep = ("000" + (fecha_inicial.getMonth()+1)).split('');
		var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND M.id_entidad_autorizadora IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
		var sql = "SELECT count(*) AS total " +  
		"FROM movimiento_" + fecha_inicial.getFullYear() + "" + mes + " M " + 
		"LEFT JOIN cajero AS C ON M.id_cajero = C.id_cajero " + 
		"LEFT JOIN geografia AS G ON C.id_geografia = G.id_geografia " + 
		"LEFT JOIN clientes_punto as CP ON CP.identificacion_extra = M.ref_recaudo " + 
		"WHERE 1  AND M.id_entidad_recaudo = 1009 " +
		userCompany + " " + userAdmin + " " + 
		userCompany + " " + userAdmin + " " + 
		(req.query.fecha_inicial !== undefined? "AND fecha_peticion >='" + req.query.fecha_inicial + " " + req.query.horaInicial + ":00'" : "AND fecha_peticion >='" + formatInicial + "'") +  " " + //La de hoy por defecto
		(req.query.fecha_final !== undefined? "AND fecha_peticion <= '" + req.query.fecha_final + " " + req.query.horaFinal + ":00'" : "AND fecha_peticion <='" + formatFinal + "'") + " " + //La de hoy por defecto
		(req.query.id_cajero!== undefined? "AND M.Id_Cajero = '" + req.query.id_cajero + "'" : "" ) + " " + //Blanco
		(req.query.tipo_transaccion!== undefined? "AND T.id_tipo_transaccion = '" + req.query.tipo_transaccion + "'" : "" ) + " " + //Blanco
		(req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" ) + " " + //Blanco
		(req.query.id_geografia!== undefined? "AND G.id_geografia = '" + req.query.id_geografia + "'": "" ) + " "  + //Blanco
		(req.query.valor_tx!== undefined? "AND valor_tx = " + req.query.valor_tx: "" ) + " "  + //Blanco
		(req.query.ref_recaudo!== undefined? "AND ref_recaudo = '" + req.query.ref_recaudo + "'": "" ) + " "  + //Blanco
		"ORDER BY fecha_peticion DESC";
		//console.log(sql);
		dbConnection.query(sql, (err, result) => {
			if(err){
			console.log(err);
			}
			else{
				res.status(200).json({'total':result[0].total});
				//console.log(result.length);
			} 
		})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/crearajuste', (req, res) => {
		if(req.isAuthenticated()){

			const id_movimiento = req.body.id,
			tabla = req.body.tabla,
			d = fechaActual(),
			causal = req.body.causal,
			usuarioCrea = req.user[0].id_usuario,
			dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':');
			var sql = "SELECT cruce FROM " + tabla + " WHERE id_movimiento = " + id_movimiento;
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(200).json({code:2, message:"Error creando el ajuste."})
				}
				else if(result.length === 0){
					res.status(200).json({code:2, message:"Error creando el ajuste."})
				}
				else{
					var cruce = result[0].cruce.substring(0,3) + '1';
					sql = "INSERT INTO ajustes VALUES(" + id_movimiento + ", '" + tabla + "', '" +  dformatHour + "', '" + causal + "', " + usuarioCrea + ")";
					console.log(sql);
					dbConnection.query(sql, (err, result) => {
						if(err){
							console.log(err);
							res.status(200).json({code:2, message:"Error creando el ajuste."})
						}
						else{
							sql = "UPDATE " + tabla + " SET cruce = '" + cruce + "', ajuste = 1 WHERE id_movimiento = " + id_movimiento + ";";
							console.log(sql);
							dbConnection.query(sql, (err, result) => {
								if(err){
									console.log(err);
									res.status(200).json({code:2, message:"Error creando el ajuste."})
								}
								else{
									res.status(200).json({code:0, message: "Ajuste creado correctamente."})
								}
							});
						}
					})
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.post('/updatearqueo', (req, res) => {
		if(req.isAuthenticated()){
			var d = fechaActual(),
			dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
				[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':');
			
			var valor = req.body.valor,
			fecha = req.body.fecha,
			id = req.body.id;
			var fechaSep = fecha.split('-'),
			mesSep = ("00" + fechaSep[1]).split(''),
			mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1],
			anio = fechaSep[0];

			var sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/updatearqueo','" + req.user[0].nombre + "','" + dformatHour + "','Actualiza arqueo para id: " + id + " tabla: movim_" + anio + "" + mes + " valor: " + valor + ".');"
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
					res.status(200).json({code:2, message:"Error modificando valor de arqueo"})
				}
				else{
					var d = fechaActual(),
					dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
						d.getDate().padLeft(),
						].join('-') +' ' +
						[d.getHours().padLeft(),
						d.getMinutes().padLeft(),
						d.getSeconds().padLeft()].join(':');
					sql = "UPDATE movimiento_" + anio + "" + mes + " SET valor_tx = " + valor + ", fecha_autorizacion = '" +  dformatHour + "' WHERE id_movimiento = " + id + " AND id_tipo_transaccion = 901 ;";
					dbConnection.query(sql, (err, result) => {
						if(err){
							console.log(err);
							res.status(200).json({code:2, message:"Error modificando valor de arqueo"})
						}
						else{
							res.status(200).json({code:3, message:"Valor de arqueo actualizado correctamente."})
						}
					})
				}
			})
		}else{
			res.status(200).json({code:1,'message':'Auth required.'});
	
		}

	})

	/**
       * @api {post} /monitoreoinactividad Inactividad
       * @apiName Incatividad
       * @apiGroup Monitoreo
       *
	   * @apiParam {Integer} id_geografia_padre Id del pais a consultar.
	   * @apiParam {Integer} id_geografia Id de la ciudad a consultar.
	   * @apiParam {Integer} id_red Id de la red a consultar.
	   * 
       * @apiSuccess {JSON} JSON Información de la inactividad de los quioscos.
    */

	app.get('/monitoreoinactividad',(req, res)=>{
		if(req.isAuthenticated()){
			var fecha = fechaActual();
			var fechaSiguiente = new Date(new Date().setDate(fecha.getDate() + 31));

			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];

			var mesSepSiguiente= ("00" + (fechaSiguiente.getMonth()+1)).split('');
			var mesSiguiente = mesSepSiguiente[mesSepSiguiente.length-2] + '' + mesSepSiguiente[mesSepSiguiente.length-1];


			var userCompany = req.user[0].id_entidad === '' ? ' ' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ") ";
			var userAdmin = req.user[0].id_administrador === '' ? ' ' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ") ";
			var sql = "Select M.id_cajero,C.nombre,max(M.fecha) as fecha_actividad,now() as ahora,C.id_red, R.nombre as red,C.id_administrador,A.nombre as administrador,C.id_entidad,E.nombre as entidad,C.id_geografia, G.nombre as geografia,G.id_geografia_padre, P.nombre as geografia_padre "
			+ "FROM  "
			+ "(select id_cajero, max(fecha_peticion) as fecha,cruce from movimiento_" + fecha.getFullYear() + "" + mes + " group by id_cajero "
			+ "UNION ALL  "
			+ "select id_cajero,max(fecha_peticion) as fecha,cruce from movimiento_" + fechaSiguiente.getFullYear() + "" + mesSiguiente + " group by id_cajero "
			+ "UNION ALL "
			+ "select id_cajero,fecha_evento as fecha,'1' as cruce from evento "
			+ "UNION ALL "
			+ "select id_cajero,fecha_keepalive as fecha,'1' as cruce from cajero "
			+ ") AS M  "
			+ "RIGHT JOIN cajero as C ON M.id_cajero = C.id_cajero "
			+ "JOIN red as R ON C.id_red = R.id_red "
			+ "JOIN geografia as G ON C.id_geografia = G.id_geografia "
			+ "JOIN administrador as A ON C.id_administrador = A.id_administrador "
			+ "JOIN entidad as E ON C.id_entidad = E.id_entidad "
			+ "JOIN geografia as P ON G.id_geografia_padre = P.id_geografia "
			+ "WHERE substring(cruce,1,1)=1 "
			+ "AND C.activo = 1 "
			+ (req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" ) + " " //Blanco
			+ (req.query.id_geografia!== undefined? "AND C.id_geografia = '" + req.query.id_geografia + "'": "" ) + " " //Blanco
			+ (req.query.id_red!== undefined? "AND C.id_red = '" + req.query.id_red + "'": "" ) + " " //Blanco
			+ userCompany + userAdmin
			+ "GROUP BY M.id_cajero "
			+ "ORDER BY fecha_actividad asc ";
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
	
		}
	})

	app.get('/monitoreocollect', (req, res) => {
		if(req.isAuthenticated()){
			const fecha = fechaActual();
			var previousMonth = ('00' + (fecha.getMonth() == 0 ? '12': fecha.getMonth())).slice(-2);
			var previousYear = fecha.getMonth() == 0 ? fecha.getFullYear() -1: fecha.getFullYear(); 

			var thismonth = ('00' + (fecha.getMonth()+1)).slice(-2);

			var cajero = req.query.cajero !== undefined ? " AND id_cajero = '" + req.query.cajero + "'" : '',
			pais = req.query.pais !== undefined ? " AND G.id_geografia_padre = '" + req.query.pais + "'" : '',
			ciudad = req.query.ciudad !== undefined ? " AND id_geografia = '" + req.query.ciudad + "'" : '';
			var sql = "SELECT t1.*, G.id_geografia_padre AS pais, G.nombre AS nombre_ciudad FROM (SELECT C.id_cajero, C.nombre, C.id_geografia AS ciudad ,MAX(M.fecha_peticion) AS fecha_peticion, M.id_entidad_recaudo AS id_entidad FROM " + 
			"(SELECT * FROM cajero WHERE activo = 1 " + cajero + "" + ciudad + ") C " + 
			"LEFT JOIN " + 
			"((SELECT * FROM movimiento_" + fecha.getFullYear() + "" + thismonth + " WHERE id_tipo_transaccion = 860) " + 
			"UNION ALL " + 
			"(SELECT * FROM movimiento_" + previousYear + "" + previousMonth + " WHERE id_tipo_transaccion = 860)) M " + 
			"ON M.id_cajero = C.id_cajero GROUP BY C.id_cajero) t1, geografia G WHERE t1.ciudad = G.id_geografia " + pais + ";";
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /tipotransaccion Tipos de transaccion
       * @apiName Tipos de transaccion
       * @apiGroup Dashboard
       *
	   * 
       * @apiSuccess {JSON} JSON Información con los tipos de transacción.
    */
	
	app.get('/tipoTransaccion', (req,res) =>{
		if(req.isAuthenticated()){
		var sql = 'SELECT id_tipo_transaccion AS ID, nombre AS NOMBRE FROM tipo_transaccion ORDER BY NOMBRE';
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		}else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	})
	/**
       * @api {post} /redes Redes
       * @apiName Redes
       * @apiGroup Dashboard
       *
	   * 
       * @apiSuccess {JSON} JSON Información con la lista de redes.
    */
    app.get('/borrar2021', (req,res) =>{
		var sql = "DELETE FROM cajero WHERE id_cajero = '00020' OR id_cajero = '00021'";
		dbConnection.query(sql, (err, result) => {
			if(err) console.log(err);
			else console.log(result);
		});
	});

	app.get('/redes', (req,res) =>{
		if(req.isAuthenticated()){
		var sql = 'SELECT id_red AS ID, nombre AS NOMBRE FROM red ORDER BY NOMBRE';
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		}else{
		res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/redes', (req,res) =>{
		if(req.isAuthenticated()){
		var sql = 'SELECT id_red AS ID, nombre AS NOMBRE FROM red ORDER BY NOMBRE';
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		}else{
		res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/tipotransacciones', (req,res) =>{
		if(req.isAuthenticated()){
		var sql = 'SELECT * FROM tipo_transaccion ORDER BY NOMBRE';
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		}else{
		res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /autorizadores Autorizadores
       * @apiName Autorizadores
       * @apiGroup Dashboard
       *
	   * 
       * @apiSuccess {JSON} JSON Información con los autorizadores.
    */
	app.get('/autorizadores', (req,res)=>{
		if(req.isAuthenticated()){
		var sql = "SELECT id_entidad, nombre FROM `entidad` order by nombre";
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		} else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	/**
       * @api {post} /resultados Tipos de resultados
       * @apiName Tipos de resultados
       * @apiGroup Dashboard
       *
	   * 
       * @apiSuccess {JSON} JSON Información con los tipos de resultados.
    */
	app.get('/resultados', (req,res)=>{
		if(req.isAuthenticated()){
		var sql = "SELECT id_tipo_resultado, nombre FROM `tipo_resultado` order by nombre";
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		} else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/serial', (req, res) => {
		var sql = "SELECT Serial FROM cajero WHERE id_cajero = '" + req.query.cajero + "';";
		dbConnection.query(sql, (err, result) => {
			if(err) console.log(fechaActual()  + " " + err.toString());
			else{
				res.status(200).json({code:0, result:result})
			}
		})
	})

	app.get('/estadocajero', (req, res) => {
		if(req.isAuthenticated()){
			var cajero = req.query.cajero !== undefined ? " AND C.id_cajero = " + req.query.cajero : '',
			sql = "SELECT T.id_cajero , C.nombre, C.id_red, C.id_entidad, C.id_geografia, C.Serial, T.billetes, T.monedas, T.fecha_respuesta fecha_resp , T.fecha_respuesta AS resp_est, T.errores, T.modo, T.errores, T.response, T.serverResponse FROM keepalive_estados T, cajero C WHERE T.id_cajero = C.id_cajero " + cajero + " AND C.activo = 1;";
			//
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(fechaActual()  + " " + err.toString());
				else{
					res.status(200).json({code:0, result:result})
				}
			})
			
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/consultaestadocajero', (req, res) => {
		if(req.user.isAuthenticated()){
		var d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			 d.getMinutes().padLeft(),
						   d.getSeconds().padLeft()].join(':');
		sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/estadocajero','" + req.user[0].id_usuario + "','" + dformat + "','Usuario consultó movimientos');";
				dbConnection.query(sql, (err, result) => {
					if(err) console.log(dformat, err)
					else res.status(200).json({code:0})
				})
			}
			else{
				res.status(200).json({code:1,'message':'Auth required.'});
			}
			
	})

	app.get('/consultadetalleestadocajero', (req, res) => {
		if(req.isAuthenticated()){
			var d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
				[d.getHours().padLeft(),
				 d.getMinutes().padLeft(),
							   d.getSeconds().padLeft()].join(':');
				sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/detalleestadocajero','" + req.user[0].id_usuario + "','" + dformat + "','Usuario consultó movimientos');";
					dbConnection.query(sql, (err, result) => {
						if(err) console.log(dformat, err)
						else res.status(200).json({code:0})
					})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
		
	})

	app.get('/estadomantenimiento1', (req, res) => {
		if(req.isAuthenticated()){
			console.log(req.query.cajero);
			sql = "SELECT * FROM keepalive_mantenimiento WHERE id_cajero = '" + req.query.cajero + "';";
			
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(fechaActual()  + " " + err.toString());
				else{
					res.status(200).json({code:0, result:result})
				}
			})
			}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/estadomantenimiento2', (req, res) => {
		if(req.isAuthenticated()){
			sql = "SELECT * FROM keepalive_mantenimiento_2 WHERE id_cajero = '" + req.query.cajero + "';";
			//
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(fechaActual()  + " " + err.toString());
				else{
					res.status(200).json({code:0, result:result})
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/ultimaAperturaMantenimiento', (req, res) => {
		if(req.isAuthenticated()){
			sql = "SELECT * FROM keepalive_apertura_puerta WHERE id_cajero = '" + req.query.cajero + "';";
			//
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(fechaActual()  + " " + err.toString());
				else{
					res.status(200).json({code:0, result:result})
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/ultimoDebt', (req, res) => {
		if(req.isAuthenticated()){
			const cajero = req.query.cajero;
			var sql = "SELECT * FROM keepalive_debt where id_cajero = '" + cajero + "';";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual() , err);
				}
				else{
					res.status(200).json({code:0, result:result})
				}
			})


		} else{
			res.status(200).json({code:1,'message':'Auth required.'});	
		}
	})

	app.get('/clientespunto', (req, res) => {
		if(req.isAuthenticated()){
			const entidad = req.user[0].id_entidad == '' ? '' : ' WHERE id_entidad = ' + req.user[0].id_entidad;
			const sql = "SELECT * FROM clientes_punto " + entidad + " ;";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual() , err);
				}
				else{
					res.status(200).json({code:0, result:result})
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});	
		}
	});

	app.post('/uploadclients',  (req,res) => {
		console.log("Uploading")
		if(req.isAuthenticated()){
			upload(req, res, async (err)  => {
				if(err){
					console.log(err);
					res.status(200).json({message:"Error cargando el archivo."});
				}
				else{
					if(req.file === null){
						res.status(200).json({'message':'No se envió el archivo csv.'});
					}
					else{
						const path  = __dirname + "/csv/" + req.file.originalname;
						console.log(path)
						var json = await csv().fromFile(path);		
						var yaExistentes = [],
						errores = [];
						var counter = 0;
						json.forEach((client) => {
							counter++;
							console.log(client);
							if(req.user[0].id_entidad == '' && (client.entidad === undefined || client.entidad == '')){
								errores.push(client.identificacion);
							}
							else{
								var sql = "SELECT * FROM clientes_punto WHERE identificacion = " + client.identificacion + " " + (req.user[0].id_entidad != ''? " AND id_entidad = " + req.user[0].id_entidad + ";" : " AND id_entidad = " + client.entidad) + ";";
								dbConnection.query(sql, (err, result) => {
									if(err){
										console.log(err);
										res.status(200).json({message:"Error creando nuevos clientes."});
									}
									else if(result.length > 0){
										yaExistentes.push(client.identificacion);
									}
									else{
										if(client.identificacion === undefined || client.nombre === undefined){
											errores.push(client.identificacion);
										}
										
										else{
											sql = "INSERT INTO clientes_punto (identificacion, identificacion_extra,nombre,id_entidad) VALUES (" + client.identificacion + ", '" + client.identificacion_extra + "', '" + client.nombre + "', " + (req.user[0].id_entidad != ''? req.user[0].id_entidad : client.entidad) + ")"
											console.log(sql);
											dbConnection.query(sql, (err, result) => {
												if(err){
													console.log(err);
													errores.push(client.identificacion)
												}
												else{
													console.log(result);
												}
											})
										}
									}
								})
							}
						})
						if(counter === json.length && !res.headersSent){
							res.status(200).json({yaExistentes:yaExistentes, errores:errores});
						}
						fs.unlink(path, (err) => {
							if (err) {
							  console.error(err)
							}
						});
						
					}
				}
				
			})
		}
		else {
			res.status(200).json({code:1,'message':'Auth required.'});	
		}
	})

	app.get('/uptimekiosko',(req, res) => {
		if(req.isAuthenticated()){
			console.log(req.query);
			var inicial = req.query.inicial !== undefined ? req.query.inicial.split('_').join(' ').split('-').join('/'): fechaActual();
			var final = req.query.final !== undefined ? req.query.final.split('_').join(' ').split('-').join('/'): fechaActual();
			
			const fechaInicial = new Date(inicial),
			fechaFinal = new Date(final),
			formatInicial = [fechaInicial.getFullYear(),(fechaInicial.getMonth()+1).padLeft(),
				fechaInicial.getDate().padLeft(),
				].join('-');
			formatFinal = [fechaFinal.getFullYear(),(fechaFinal.getMonth()+1).padLeft(),
				fechaFinal.getDate().padLeft(),
				].join('-')
			cajeros = req.query.cajero !== undefined ? " AND U.id_cajero = '" + req.query.cajero + "'": ''
			ciudad = req.query.ciudad !== undefined ? "	AND C.id_geografia = " + req.query.ciudad + " ":''
			pais = req.query.pais !== undefined ? " AND G.id_geografia_padre = " + req.query.pais + " ":''
			
			sql = "SELECT C.nombre, U.* FROM uptime_kiosko U, cajero C, geografia G " + 
			"WHERE U.id_cajero = C.id_cajero AND C.id_geografia = G.id_geografia " + 
			"AND fecha >= '" + formatInicial + "' AND fecha <= '" + formatFinal + "' " + cajeros + ciudad + pais + ";";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);					
					res.status(200).json({code: 2,'message':"Error consultando la base de datos."});

				}
				else{
					res.status(200).json({'result':result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.get('/ultimosEventosKiosko', (req, res) => {
		if(req.isAuthenticated()){
			const eventos = [{id:20602},{id:20603},{id:20701},{id:20702},{id:20402},
							{id:20403},{id:20404},{id:20405},{id:50603},{id:50602},
							{id:10600},{id:10601},{id:10604},{id:10605},{id:90101},
							{id:10604},{id:10605}],
			arr = eventos.map((el) => {return el.id});
			cajero = req.query.cajero;
			var sql = "SELECT TE.id_tipo_evento, TE.descripcion, E.fecha FROM (SELECT TE.id_tipo_evento, TE.descripcion " +
			"FROM tipo_evento TE " +
			"WHERE TE.id_tipo_evento IN (" + arr + ") " +
			"AND TE.id_rol LIKE '%" + req.user[0].rol_idrol + "%') TE " +
			"LEFT JOIN " +
			"(SELECT MAX(fecha_evento) AS fecha, id_tipo_evento " +
			"FROM evento " +
			"WHERE id_cajero = '" + cajero + "' GROUP BY id_tipo_evento) E " +
			"ON TE.id_tipo_evento = E.id_tipo_evento ORDER BY E.fecha DESC;";
			console.log(sql);
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(fechaActual() , err);
				}
				else{
					res.status(200).json({code:0, result:result})
				}
			})


		} else{
			res.status(200).json({code:1,'message':'Auth required.'});	
		}
	})

	/**
       * @api {post} /cajeros Quioscos
       * @apiName Quioscos
       * @apiGroup Dashboard
       *
	   * 
       * @apiSuccess {JSON} JSON Información con los quioscos.
    */
	app.get('/cajeros', (req,res)=>{
		if(req.isAuthenticated()){
		var userCompany = req.user[0].id_entidad === '' ? '' : "AND id_entidad IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
		var sql = "SELECT id_cajero, nombre FROM `cajero` WHERE 1 " +  /* userCompany + " " + userAdmin + */ " order by nombre";
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		} else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	});

	app.get('/listadocajeros', (req,res)=>{
		if(req.isAuthenticated()){
		var userCompany = req.user[0].id_entidad === '' ? '' : req.user[0].id_entidad == '1009' ? "	 AND PK.entidades_autorizadoras LIKE '%1009%' ":  " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
		var sql = "SELECT C.id_cajero, C.nombre, GP.nombre AS pais, G.nombre AS ciudad, C.direccion, C.Latitud, C.Longitud, E.nombre AS nombre_entidad, R.nombre AS nombre_red, C.SIM, C.AnyDesk, C.activo, C.Serial FROM cajero C, entidad E, red R, geografia G, geografia GP, parametro_kiosko PK WHERE C.id_entidad = E.id_entidad AND C.id_red = R.id_red AND C.id_geografia = G.id_geografia AND PK.id_cajero = C.id_cajero AND G.id_geografia_padre = GP.id_geografia " + userAdmin + " " + userCompany;
		console.log(sql);
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		} else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	});

	app.get('/listadokad', (req,res)=>{
		if(req.isAuthenticated() && (req.user[0].rol_idrol == '1' || req.user[0].rol_idrol == '5')){
			var sql = "SELECT * FROM usuario_kiosko WHERE id_tipo_usuario_kiosko = 4;";
			console.log(sql);
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	/**
       * @api {post} /eventos Tipos de eventos
       * @apiName Tipos de eventos
       * @apiGroup Dashboard
       *
	   * 
       * @apiSuccess {JSON} JSON Información con los tipos de eventos.
    */
	app.get('/eventos', (req,res)=>{
		if(req.isAuthenticated()){
		var sql = "SELECT id_tipo_evento, descripcion FROM `tipo_evento` order by descripcion";
		dbConnection.query(sql, function(err, result){
			if(err) console.log(err);
			else res.status(200).json({'result':result});
		})
		} else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	});

	var fechasEventos = function(fecha_inicial, fecha_final, cb){
		var fecha_inicialDate = fecha_inicial !== undefined ? new Date(fecha_inicial.split('-').join('/')): fechaActual(), 
		formatInicial = [fecha_inicialDate.getFullYear(),(fecha_inicialDate.getMonth()+1).padLeft(),(fecha_inicialDate.getDate()).padLeft()].join('-');
		if(fecha_final === undefined) var formatFinal = [fecha_inicialDate.getFullYear(),(fecha_inicialDate.getMonth()+1).padLeft(),(fecha_inicialDate.getDate()+1).padLeft()].join('-');
		else{
			fecha_finalDate = fecha_final !== undefined ? new Date(fecha_final.split('-').join('/')): fechaActual();
			var formatFinal = [fecha_finalDate.getFullYear(),(fecha_finalDate.getMonth()+1).padLeft(),(fecha_finalDate.getDate()).padLeft()].join('-');
			var nextDay = new Date(fecha_finalDate.setDate(fecha_finalDate.getDate() + 1));
			var formatFinalNext = [nextDay.getFullYear(),(nextDay.getMonth()+1).padLeft(),(nextDay.getDate()).padLeft()].join('-');
			if(fecha_inicial === undefined){
				formatInicial = formatFinal;
			}
		}
		var fechas = [];
		fechas.push({'inicial':formatInicial + ' 00:00:00','final':formatFinal + ' 23:59:59','siguiente':formatFinalNext});
		cb(fechas);
	}

	/**
       * @api {post} /eventoskioskos Eventos de un quiosco
       * @apiName Eventos de un quiosco
       * @apiGroup Eventos
       *
	   * @apiParam {String} fecha_inicial Fecha inicial de la consulta.
	   * @apiParam {String} fecha_final Fecha final de la consulta.
	   * @apiParam {Integer} id_cajero Id del quiosco a consultar.
	   * @apiParam {Integer} evento Tipo de evento a consultar.
	   * 
       * @apiSuccess {JSON} JSON Información con los eventos de uno o varios quioscos.
    */


	//Viejo

	/*app.get('/eventoskioskos', (req, res) => {
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql = "SELECT "
				+ "E.id_cajero, C.nombre as cajero, E.id_tipo_evento, E.fecha_evento,T.sigla,T.codigo,T.descripcion, E.parametro "
				+ "FROM evento E, tipo_evento T, cajero C "
				+ "WHERE 1 "
				+ userCompany + " " + userAdmin + " "
				+ "AND E.id_tipo_evento = T.id_tipo_evento "
				+ "AND E.id_cajero = C.id_cajero "
				+ "AND fecha_evento >= '" + fechas[0].inicial + "' "
				+ "AND fecha_evento <= '" + fechas[0].siguiente + "' "
				+ "AND T.id_rol LIKE '%," +  req.user[0].rol_idrol + ",%' "
				+ (req.query.id_cajero !== undefined ? "AND E.id_cajero = '" + req.query.id_cajero + "' " : "") + " "
				+ (req.query.evento !== undefined? "AND E.Id_tipo_evento = '" + req.query.evento + "' " : "") + " " 
				+ "ORDER BY fecha_evento DESC";
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				})
			})
		}
		else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	})*/

	//Nuevo

	app.get('/eventoskioskos', (req, res) => {
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var page = req.query.page,
				cantidad = req.query.cantidad !== '' && req.query.cantidad !== undefined && req.query.page !== null? req.query.cantidad : 100,
				limit = page !== null && page !== undefined && page !== '' ?  "LIMIT " + ((page-1)*cantidad) + "," + cantidad + ";":';'
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql = "SELECT "
				+ "E.id_cajero, C.nombre as cajero, E.id_tipo_evento, E.fecha_evento,T.sigla,T.codigo,T.descripcion, E.parametro "
				+ "FROM evento E, tipo_evento T, cajero C "
				+ "WHERE 1 "
				+ userCompany + " " + userAdmin + " "
				+ "AND E.id_tipo_evento = T.id_tipo_evento "
				+ "AND E.id_cajero = C.id_cajero "
				+ "AND fecha_evento >= '" + fechas[0].inicial + "' "
				+ "AND fecha_evento <= '" + fechas[0].final + "' "
				+ "AND T.id_rol LIKE '%," +  req.user[0].rol_idrol + ",%' "
				+ (req.query.id_cajero !== undefined ? "AND E.id_cajero = '" + req.query.id_cajero + "' " : "") + " "
				+ (req.query.evento !== undefined? "AND E.Id_tipo_evento = '" + req.query.evento + "' " : "") + " " 
				+ "ORDER BY fecha_evento DESC " + limit ;
				console.log(sql);
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						console.log(result.length)
						res.status(200).json({'result':result});
					}
				})

				var d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			 d.getMinutes().padLeft(),
						   d.getSeconds().padLeft()].join(':');
			sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/eventoskioskos','" + req.user[0].id_usuario + "','" + dformat + "','Usuario consultó movimientos');";
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Usuario consultó eventos: " + id_usuario)})
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/totaleventoskioskos', (req, res) => {
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var page = req.query.page,
			cantidad = req.query.cantidad !== '' && req.query.cantidad !== undefined && req.query.page !== null? req.query.cantidad : 100,
			limit = page !== null && page !== undefined && page !== '' ?  "LIMIT " + ((page-1)*cantidad) + "," + cantidad + ";":';'
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql = "SELECT "
				+ "count(*) AS total "
				+ "FROM evento E, tipo_evento T, cajero C "
				+ "WHERE 1 "
				+ userCompany + " " + userAdmin + " "
				+ "AND E.id_tipo_evento = T.id_tipo_evento "
				+ "AND E.id_cajero = C.id_cajero "
				+ "AND fecha_evento >= '" + fechas[0].inicial + "' "
				+ "AND fecha_evento <= '" + fechas[0].siguiente + "' "
				+ "AND T.id_rol LIKE '%," +  req.user[0].rol_idrol + ",%' "
				+ (req.query.id_cajero !== undefined ? "AND E.id_cajero = '" + req.query.id_cajero + "' " : "") + " "
				+ (req.query.evento !== undefined? "AND E.Id_tipo_evento = '" + req.query.evento + "' " : "") + " " 
				+ "ORDER BY fecha_evento DESC " + limit + ";";
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result[0].total});
					}
				})
			})
		}
		else{
		res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	/**
       * @api {post} /compensacionadquiriente Compensacion Adquiriente
       * @apiName Compensacion Adquiriente
       * @apiGroup Compensacion
       *
	   * @apiParam {String} fecha_inicial Fecha inicial de la consulta.
	   * @apiParam {String} fecha_final Fecha final de la consulta.
	   * @apiParam {Integer} id_cajero Id del quiosco a consultar.
	   * @apiParam {Integer} id_red Id de la red a consultar.
	   * @apiParam {String} id_geografia_padre Pais a consultar.
	   * 
       * @apiSuccess {JSON} JSON Información de la compensación de los adquirientes.
    */
	
   app.get('/compensacionadquiriente', function(req, res){
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var fecha = fechas[0].inicial;
				var previousMonth = ('00' + (fecha.split('-')[1] == '01' ? '12': parseInt(fecha.split('-')[1]) - 1)).slice(-2);
				var previousYear = fecha.split('-')[1] == '01' ? parseInt(fecha.split('-')[0]) -1: parseInt(fecha.split('-')[0]); 
				var sql = "SELECT V.id_geografia_padre,red,ADQ.nombre as ADQ,AUT.nombre as AUT, " +
				"SUM(CASE WHEN entrada_salida = 1 THEN valor_tx END) AS cash_in, " +
				"SUM(CASE WHEN entrada_salida = 2 THEN valor_tx END) AS cash_out, " +
				"SUM(CASE WHEN entrada_salida = 3 THEN valor_tx END) AS in_out, " +
				"SUM(CASE WHEN entrada_salida > 3 THEN valor_tx END) AS otras, " +
				"SUM(CASE WHEN entrada_salida = 1 THEN cantidad END) AS cdad_cash_in, " +
				"SUM(CASE WHEN entrada_salida = 2 THEN cantidad END) AS cdad_cash_out, " +
				"SUM(CASE WHEN entrada_salida = 3 THEN cantidad END) AS cdad_in_out, " +
				"SUM(CASE WHEN entrada_salida > 3 THEN cantidad END) AS cdad_otras " + 
				"FROM ( " +
				"select * from View_" + previousYear + '' + previousMonth + " " + 
				"UNION ALL " +
				"select * from View_" + fecha.split('-')[0] + fecha.split('-')[1] + ") AS V " +
				"JOIN entidad ADQ ON V.id_entidad_adquiriente = ADQ.id_entidad " +
				"JOIN entidad AUT ON V.id_entidad_autorizadora = AUT.id_entidad " +
				"JOIN cajero C ON V.id_cajero = C.id_cajero " + 
				"WHERE 1 " +
				"AND fecha_negocio >= '" + fechas[0].inicial + "' " +
				"AND fecha_negocio <= '" + fechas[0].final + "' " +
				(req.query.id_cajero !== undefined ? "AND V.id_cajero = '" + req.query.id_cajero + "' " : "") +
				(req.query.id_red !== undefined ? "AND V.id_red = '" + req.query.id_red + "' " : "") + 
				(req.query.id_geografia_padre !== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "' ": "" ) + 
				"GROUP BY id_geografia_padre,ADQ,AUT " +
				"ORDER BY id_geografia_padre,red,ADQ,AUT;";

				//
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
			});	
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/compensacionautorizador', function(req, res){
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var fecha = fechas[0].inicial;
				var previousMonth = ('00' + (fecha.split('-')[1] == '01' ? '12': parseInt(fecha.split('-')[1]) - 1)).slice(-2);
				var previousYear = fecha.split('-')[1] == '01' ? parseInt(fecha.split('-')[0]) -1: parseInt(fecha.split('-')[0]); 
				var sql = "SELECT V.id_geografia_padre,red,AUT.nombre as AUT, " + 
				"SUM(CASE WHEN entrada_salida = 1 THEN valor_tx END) AS cash_in,  " + 
				"SUM(CASE WHEN entrada_salida = 2 THEN valor_tx END) AS cash_out,  " + 
				"SUM(CASE WHEN entrada_salida = 3 THEN valor_tx END) AS in_out,  " + 
				"SUM(CASE WHEN entrada_salida > 3 THEN valor_tx END) AS otras,  " + 
				"SUM(CASE WHEN entrada_salida = 1 THEN cantidad END) AS cdad_cash_in, " +  
				"SUM(CASE WHEN entrada_salida = 2 THEN cantidad END) AS cdad_cash_out,  " + 
				"SUM(CASE WHEN entrada_salida = 3 THEN cantidad END) AS cdad_in_out,  " + 
				"SUM(CASE WHEN entrada_salida > 3 THEN cantidad END) AS cdad_otras " + 
				"FROM ( " +
				"select * from View_" + previousYear + '' + previousMonth + " " + 
				"UNION ALL " +
				"select * from View_" + fecha.split('-')[0] + fecha.split('-')[1] + ") as V " + 
				"JOIN entidad AUT ON V.id_entidad_autorizadora = AUT.id_entidad " + 
				"WHERE 1 " +
				"AND fecha_negocio >= '" + fechas[0].inicial + "' " +
				"AND fecha_negocio <= '" + fechas[0].final + "' " +
				(req.query.id_cajero !== undefined ? "AND V.id_cajero = '" + req.query.id_cajero + "' " : "") +
				(req.query.id_geografia_padre !== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "' ": "" ) + 
				"GROUP BY id_geografia_padre, AUT " + 
				"ORDER BY id_geografia_padre,red,AUT;";

				console.log(sql)
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
			});	
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	app.get('/compensacioncomisiones', function(req, res){
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var fecha = fechas[0].inicial;
				var previousMonth = ('00' + (fecha.split('-')[1] == '01' ? '12': parseInt(fecha.split('-')[1]) - 1)).slice(-2);
				var previousYear = fecha.split('-')[1] == '01' ? parseInt(fecha.split('-')[0]) -1: parseInt(fecha.split('-')[0]); 
				var sql = "SELECT V.id_geografia_padre,red,AUT.nombre as AUT, " + 
				"SUM(CASE WHEN entrada_salida = 1 THEN valor_comision END) AS cash_in,  " + 
				"SUM(CASE WHEN entrada_salida = 2 THEN valor_comision END) AS cash_out,  " + 
				"SUM(CASE WHEN entrada_salida = 3 THEN valor_comision END) AS in_out,  " + 
				"SUM(CASE WHEN entrada_salida > 3 THEN valor_comision END) AS otras,  " + 
				"SUM(CASE WHEN entrada_salida = 1 THEN cantidad END) AS cdad_cash_in, " +  
				"SUM(CASE WHEN entrada_salida = 2 THEN cantidad END) AS cdad_cash_out,  " + 
				"SUM(CASE WHEN entrada_salida = 3 THEN cantidad END) AS cdad_in_out,  " + 
				"SUM(CASE WHEN entrada_salida > 3 THEN cantidad END) AS cdad_otras " + 
				"FROM ( " +
				"select * from View_" + previousYear + '' + previousMonth + " " + 
				"UNION ALL " +
				"select * from View_" + fecha.split('-')[0] + fecha.split('-')[1] + ") as V " + 
				"JOIN entidad AUT ON V.id_entidad_autorizadora = AUT.id_entidad " + 
				"WHERE 1 " +
				"AND fecha_negocio >= '" + fechas[0].inicial + "' " +
				"AND fecha_negocio <= '" + fechas[0].final + "' " +
				(req.query.id_cajero !== undefined ? "AND V.id_cajero = '" + req.query.id_cajero + "' " : "") +
				(req.query.id_geografia_padre !== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "' ": "" ) + 
				"GROUP BY AUT " + 
				"ORDER BY AUT;";

				console.log(sql)
				dbConnection.query(sql, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
			});	
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});

		}
	})

	//Metodo que encripta y desencripta las claves del usuario
	/*var generatepwd = function(){
		console.log('Entra');
		var pwd = '1234';
		var identificacion = '1020820907';
		encrypter.encrypt(pwd,(hash)=>{
			var id_sep = identificacion.split('');
			var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
			console.log("Final " + final);
			var primero = final.slice(1);
			var segundo = primero.slice(0,5) + primero.slice(6, primero.length);
			var inicial = segundo.slice(0, segundo.length-1)
			console.log("Inicial " + inicial);
		});
	}

	generatepwd();*/

	var cambiarPWDTodos = function(){
		var sql = "SELECT * FROM usuario";
		dbConnection.query(sql, (err, result) =>{
			if(err) console.log(err);
			else{
				//console.log(result);
				result.forEach((usuario) => {
					encrypter.encrypt(usuario.identificacion_usuario, (hash)=>{
						console.log(usuario.identificacion_usuario)
						console.log("Hash " + hash);
						//console.log(usuario.identificacion_usuario)
						var id_sep = usuario.identificacion_usuario.split('');
						var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
						console.log("Final " + final);
						sql  ="UPDATE usuario SET pwd = '" + final + "', fecha_renovacion_pwd = '2018-01-01' WHERE identificacion_usuario = '" + usuario.identificacion_usuario + "';";
						var primero = final.slice(1);
						var segundo = primero.slice(0,6) + primero.slice(7, primero.length);
						var inicial = segundo.slice(0, -1);
						/*encrypter.checkHash(usuario.identificacion_usuario, hash, (res) =>{
							console.log("iguales "+  res)
						},()=>{
							console.log("diferentes")
						})*/
						dbConnection.query(sql, (err, result)=>{
							if(err) console.log(err);
							else{
								console.log(result.message);
							}
						});
					});
				})
			}
		})
	}

	var cambiarPWDTodosCajero = function(){
		var sql = "SELECT * FROM cajero Where Serial = 'CVLT61450A6G120GGN'";
		dbConnection.query(sql, (err, result) =>{
			if(err) console.log(err);
			else{
				//console.log(result);
				result.forEach((cajero) => {
					if(cajero.Serial !== null){
					encrypter.encrypt('Kiosk636261', (hash)=>{
						var id_sep = cajero.Serial.split('');
						var final = [id_sep[0], hash.slice(0,6), id_sep[1], hash.slice(6), id_sep[2]].join('');
						//console.log(hash);
						//console.log(final);
						sql  ="UPDATE cajero SET secreto = '" + final + "' WHERE Serial = '" + cajero.Serial + "';";
						dbConnection.query(sql, (err, result)=>{
							if(err) console.log(err);
							else{
								console.log(result.message);
							}
						});
					});
				}
				})
			}
		})
	}
	
	//Cambia la contraseña de todos los usuario

	/*app.get('/cambiartodo',(req, res)=> {
		cambiarPWDTodos();
	})*/
	
	//Cambia la contraseña de todos los usuario

	/*app.get('/cambiartodocajero',(req, res)=> {
		cambiarPWDTodosCajero();
	})*/


	/**
       * @api {post} /totalesrecaudo Totales Recaudo
       * @apiName Totales Recaudo
       * @apiGroup Reportes
       *
	   * @apiParam {String} fecha_inicial Fecha inicial de la consulta.
	   * @apiParam {String} fecha_final Fecha final de la consulta.
	   * @apiParam {Integer} id_cajero Id del quiosco a consultar.
	   * @apiParam {String} id_geografia_padre Pais a consultar.
	   * @apiParam {String} id_geografia Ciudad a consultar.
	   * @apiParam {Integer} id_red Red a consultar.
	   * @apiParam {Integer} id_administrador Id del administrador a consultar.
       * @apiSuccess {JSON} JSON Información de los totales de recaudo.
    */

	//Query anterior (Funciona)
	/*app.get('/totalesrecaudo', function(req, res){	
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var fecha = fechas[0].inicial;
				var previousMonth = ('00' + (fecha.split('-')[1] == '01' ? '12': parseInt(fecha.split('-')[1]) - 1)).slice(-2);
				var previousYear = fecha.split('-')[1] == '01' ? parseInt(fecha.split('-')[0]) -1: parseInt(fecha.split('-')[0]); 
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql1 = "SELECT M.id_cajero as id_cajero, C.nombre as cajero, min(fecha_peticion) as inicio, max(fecha_peticion) as fin, G.nombre as geo, count(*) AS cantidad, "
				+ "sum(substring(billete_in,1,4)) as b1, "
				+ "sum(substring(billete_in,5,4)) as b2, "
				+ "sum(substring(billete_in,9,4)) as b3, "
				+ "sum(substring(billete_in,13,4)) as b4, "
				+ "sum(substring(billete_in,17,4)) as b5, "
				+ "sum(substring(billete_in,21,4)) as b6, "
				+ "sum(substring(billete_in,25,4)) as b7, "
				+ "sum(substring(moneda_in,1,4)) as c1, "
				+ "sum(substring(moneda_in,5,4)) as c2, "
				+ "sum(substring(moneda_in,9,4)) as c3, "
				+ "sum(substring(moneda_in,13,4)) as c4, "
				+ "sum(substring(moneda_in,17,4)) as c5, "
				+ "SUM(valor_tx) AS valor_tx "
				+ "FROM (SELECT * FROM movimiento_" + previousYear + '' + previousMonth + " UNION ALL SELECT * FROM movimiento_" + fecha.split('-')[0] + fecha.split('-')[1] + ") AS M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia "
				+ "WHERE M.fecha_retiro_valores <> '' "
				+ userCompany + " " + userAdmin + " "
				+ "AND T.entrada_salida = 1 "
				+ "AND substring(cruce,1,1) = 1 "
				+ "AND id_tipo_resultado_tlf = 0 "
				+ "AND M.fecha_retiro_valores >= '" + fechas[0].inicial + " 00:00:00' "
				+ "AND M.fecha_retiro_valores <= '" + fechas[0].final + " 23:59:59' "
				+ (req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "' " : "")
				+ (req.query.id_geografia !== undefined ? "AND G.id_geografia = '" + req.query.id_geografia + "' " : "")
				+ (req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" )
				+ (req.query.id_red !== undefined ? "AND C.id_red = '" + req.query.id_red + "' " : "")
				+ (req.query.id_administrador !== undefined ? "AND C.id_administrador = '" + req.query.id_administrador + "' " : "")
				+ "GROUP BY id_cajero, fecha_retiro_valores "
				+ "ORDER BY id_cajero, fecha_retiro_valores;";
				dbConnection.query(sql1, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})*/

	//Query nuevo
	app.get('/totalesrecaudo', function(req, res){	
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var fecha = fechas[0].inicial;
				var previousMonth = ('00' + (fecha.split('-')[1] == '01' ? '12': parseInt(fecha.split('-')[1]) - 1)).slice(-2);
				var previousYear = fecha.split('-')[1] == '01' ? parseInt(fecha.split('-')[0]) -1: parseInt(fecha.split('-')[0]); 
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql1 = "SELECT M.id_cajero as id_cajero, C.nombre as cajero, min(fecha_peticion) as inicio, max(fecha_peticion) as fin, G.nombre as geo, count(*) AS cantidad, "
				+ "sum(substring(billete_in,1,4)) as b1, "
				+ "sum(substring(billete_in,5,4)) as b2, "
				+ "sum(substring(billete_in,9,4)) as b3, "
				+ "sum(substring(billete_in,13,4)) as b4, "
				+ "sum(substring(billete_in,17,4)) as b5, "
				+ "sum(substring(billete_in,21,4)) as b6, "
				+ "sum(substring(billete_in,25,4)) as b7, "
				+ "sum(substring(moneda_in,1,4)) as c1, "
				+ "sum(substring(moneda_in,5,4)) as c2, "
				+ "sum(substring(moneda_in,9,4)) as c3, "
				+ "sum(substring(moneda_in,13,4)) as c4, "
				+ "sum(substring(moneda_in,17,4)) as c5, "
				+ "SUM(valor_tx) AS valor_tx "
				+ "FROM (SELECT * FROM movimiento_" + previousYear + '' + previousMonth + " UNION ALL SELECT * FROM movimiento_" + fecha.split('-')[0] + fecha.split('-')[1] + ") AS M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia "
				+ "WHERE M.fecha_retiro_valores <> '' "
				+ userCompany + " " + userAdmin + " "
				+ "AND T.entrada_salida = 1 "
				+ "AND substring(cruce,1,1) = 1 "
				+ "AND id_tipo_resultado_tlf = 0 "
				+ "AND M.fecha_retiro_valores >= '" + fechas[0].inicial + " 00:00:00' "
				+ "AND M.fecha_retiro_valores <= '" + fechas[0].final + " 23:59:59' "
				+ (req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "' " : "")
				+ (req.query.id_geografia !== undefined ? "AND G.id_geografia = '" + req.query.id_geografia + "' " : "")
				+ (req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" )
				+ (req.query.id_red !== undefined ? "AND C.id_red = '" + req.query.id_red + "' " : "")
				+ (req.query.id_administrador !== undefined ? "AND C.id_administrador = '" + req.query.id_administrador + "' " : "")
				+ "GROUP BY id_cajero, fecha_retiro_valores "
				+ "ORDER BY id_cajero, fecha_retiro_valores;";
				dbConnection.query(sql1, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})


	/**
       * @api {post} /totalescuadre Totales Cuadre
       * @apiName Totales Cuadre
       * @apiGroup Cuadre
       *
	   * @apiParam {String} fecha_inicial Fecha inicial de la consulta.
	   * @apiParam {String} fecha_final Fecha final de la consulta.
	   * @apiParam {Integer} id_cajero Id del quiosco a consultar.
	   * @apiParam {String} id_geografia_padre Pais a consultar.
	   * @apiParam {String} id_geografia Ciudad a consultar.
	   * @apiParam {Integer} id_red Red a consultar.
	   * @apiParam {Integer} id_administrador Id del administrador a consultar.
	   * 
       * @apiSuccess {JSON} JSON Información de los totales de cuadre.
    */

	//Nuevo query prueba

	app.get('/totalescuadre', function(req, res){	
		if(req.isAuthenticated()){

			var d = fechaActual(),
		dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			 d.getMinutes().padLeft(),
						   d.getSeconds().padLeft()].join(':');
			sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/totalescuadre','" + req.user[0].id_usuario + "','" + dformat + "','Usuario consultó movimientos');";
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Usuario consultó totales cuadre: " + id_usuario)})

			
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var fecha = fechas[0].inicial;
				var previousMonth = ('00' + (fecha.split('-')[1] == '01' ? '12': parseInt(fecha.split('-')[1]) - 1)).slice(-2);
				var previousYear = fecha.split('-')[1] == '01' ? parseInt(fecha.split('-')[0]) -1: parseInt(fecha.split('-')[0]); 
				
				var previousMonth2 = (('00' + (fecha.split('-')[1] == '02' ? '12': (fecha.split('-')[1] == 01? '11': parseInt(fecha.split('-')[1]) - 2))).slice(-2));
				var previousYear2 = fecha.split('-')[1] == '02' || fecha.split('-')[1] == '01' ? parseInt(fecha.split('-')[0]) -1: parseInt(fecha.split('-')[0]); 
				
				
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql1 = "SELECT M.id_cajero as id_cajero, C.nombre as cajero, min(fecha_peticion) as inicio, max(fecha_peticion) as fin, G.nombre as geo, count(*) AS cantidad, "
				+ "sum(CASE WHEN T.entrada_salida = 1 AND substring(cruce,1,1) = 1 THEN valor_tx ELSE 0 END) AS valor_tx, "
				+"max(id_movimiento) as id_movimiento,max(fecha_negocio) as fecha_negocio, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN valor_tx ELSE 0 END) AS valor_totales, "
				//Valores para ajustes
				+ "sum(CASE WHEN substring(cruce,4,1) = 1 AND substring(cruce,1,1) = 1 AND substring(cruce,3,1) = 0 THEN valor_tx ELSE 0 END) AS sistema_no_quiosco, "
				+ "sum(CASE WHEN substring(cruce,4,1) = 1 AND substring(cruce,1,1) = 0 AND substring(cruce,3,1) = 1 THEN valor_tx ELSE 0 END) AS quiosco_no_sistema, "
				//Valores arqueo
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 901 THEN valor_tx ELSE 0 END) AS valor_arqueo, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(billete_in,1,4) ELSE 0 END) AS Tb1, "				
				+ "sum(CASE WHEN T.entrada_salida = 1  THEN substring(billete_in,1,4) ELSE 0 END) as b1, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(billete_in,5,4) ELSE 0 END) AS Tb2, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(billete_in,5,4) ELSE 0 END) as b2, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(billete_in,9,4) ELSE 0 END) AS Tb3, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(billete_in,9,4) ELSE 0 END) as b3, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(billete_in,13,4) ELSE 0 END) AS Tb4, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(billete_in,13,4) ELSE 0 END) as b4, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(billete_in,17,4) ELSE 0 END) AS Tb5, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(billete_in,17,4) ELSE 0 END) as b5, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(billete_in,21,4) ELSE 0 END) AS Tb6, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(billete_in,21,4) ELSE 0 END) as b6, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(billete_in,25,4) ELSE 0 END) AS Tb7, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(billete_in,25,4) ELSE 0 END) as b7, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(moneda_in,1,4) ELSE 0 END) AS Tc1, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(moneda_in,1,4) ELSE 0 END) as c1, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(moneda_in,5,4) ELSE 0 END) AS Tc2, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(moneda_in,5,4) ELSE 0 END) as c2, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(moneda_in,9,4) ELSE 0 END) AS Tc3, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(moneda_in,9,4) ELSE 0 END) as c3, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(moneda_in,13,4) ELSE 0 END) AS Tc4, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(moneda_in,13,4) ELSE 0 END) as c4, "
				+ "sum(CASE WHEN T.entrada_salida = 0 AND T.id_tipo_transaccion = 900 THEN substring(moneda_in,17,4) ELSE 0 END) AS Tc5, "				
				+ "sum(CASE WHEN T.entrada_salida = 1 THEN substring(moneda_in,17,4) ELSE 0 END) as c5 "
				+ "FROM ( SELECT * FROM movimiento_" + previousYear2 + '' + previousMonth2 + " UNION ALL SELECT * FROM movimiento_" + previousYear + '' + previousMonth + " UNION ALL SELECT * FROM movimiento_" + fecha.split('-')[0] + fecha.split('-')[1] + ") AS M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia "
				+ "WHERE M.fecha_retiro_valores <> '' "
				+ userCompany + " " + userAdmin + " "
				+ "AND T.entrada_salida IN (0,1) "
				//+ "AND substring(cruce,1,1) = 1 "
				+ "AND id_tipo_resultado_tlf = 0 "
				+ "AND M.fecha_retiro_valores >= '" + fechas[0].inicial + " 00:00:00' "
				+ "AND M.fecha_retiro_valores <= '" + fechas[0].final + " 23:59:59' "
				+ (req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "' " : "")
				+ (req.query.id_geografia !== undefined ? "AND G.id_geografia = '" + req.query.id_geografia + "' " : "")
				+ (req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" )
				+ (req.query.id_red !== undefined ? "AND C.id_red = '" + req.query.id_red + "' " : "")
				+ (req.query.id_administrador !== undefined ? "AND C.id_administrador = '" + req.query.id_administrador + "' " : "")
				+ "GROUP BY id_cajero, fecha_retiro_valores "
				+ "ORDER BY id_cajero, fecha_retiro_valores;";
				console.log(sql1);
				dbConnection.query(sql1, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})

	app.get('/detallecuadre', (req, res) => {
		if(req.isAuthenticated()){
			var crucequery = "AND substring(cruce,1,1) = 1 ",
			cruce = req.query.cruce;
			if(cruce !== undefined){
				if(cruce == 'sis'){
					crucequery =  "AND substring(cruce,1,1) = 1 ";
				}
				else if(cruce == 'kio'){
					crucequery =  "AND substring(cruce,3,1) = 1 ";

				}
				else if(cruce == 'sisnkio'){
					crucequery =  "AND substring(cruce,1,1) = 1 AND substring(cruce,3,1) = 0 ";

				}
				else if(cruce == 'kionsis'){
					crucequery =  "AND substring(cruce,1,1) = 0 AND substring(cruce,3,1) = 1 ";

				}
			}
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			
			var stringfecha = req.query.fecha;
			
			var fecha = new Date(stringfecha.split('_').join(' ')),
			d = fecha;
			dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
				[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':');
			var previousMonth = ('00' + (fecha.getMonth() == 0 ? '12': fecha.getMonth())).slice(-2);
			var previousYear = fecha.getMonth() == 0 ? fecha.getFullYear() -1: fecha.getFullYear(); 

			var thismonth = ('00' + (fecha.getMonth()+1)).slice(-2);
			var sql = "SELECT M.Id_movimiento, M.fecha_peticion,M.id_cajero as id_cajero, C.nombre as cajero, M.Valor_Tx,M.Secuencia, M.ref_recaudo,M.cruce, M.id_tipo_transaccion,T.nombre, M.fecha_retiro_valores "
			+ "FROM (SELECT * FROM movimiento_" + previousYear + '' + previousMonth + " UNION ALL SELECT * FROM movimiento_" + fecha.getFullYear() + "" + thismonth + " ) AS M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red "
			+ "WHERE M.fecha_retiro_valores <> '' "
			+ userCompany + " " + userAdmin + " "
			+ "AND T.entrada_salida IN (1) "
			+ "AND  (M.autorizacion <> '' OR M.autorizacion is not null) "
			+ crucequery
			+ "AND id_tipo_resultado_tlf = 0 "
			+ "AND (M.fecha_retiro_valores > '" + dformatHour + "' "
			+ "OR (fecha_retiro_valores = '0000-00-00 00:00:00' AND fecha_peticion >= "
			+ "(select min(fecha_peticion) as fecha_peticion "
			+ "FROM (SELECT * FROM movimiento_" + previousYear + "" + previousMonth + " UNION ALL SELECT * FROM movimiento_" + d.getFullYear() + "" + thismonth + " ) AS N "
			+ "where fecha_retiro_valores = '" + dformatHour + "' and id_cajero= '" + req.query.id_cajero + "'))) "
			+ (req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "' " : " ")
			+ (req.query.id_red !== undefined ? "AND C.id_red = '" + req.query.id_red + "' " : "")
			+ (req.query.id_administrador !== undefined ? "AND C.id_administrador = '" + req.query.id_administrador + "' " : "")
			+ "ORDER BY id_cajero, fecha_retiro_valores;";
			console.log(sql);
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
				}
				else{
					res.status(200).json({'result':result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}	
	})

	app.get('/detallecuadreinconsistentes', (req, res) => {
		if(req.isAuthenticated()){
			var crucequery = "AND substring(cruce,1,1) = 1 ",
			cruce = req.query.cruce;
			if(cruce !== undefined){
				if(cruce == 'sis'){
					crucequery =  "AND substring(cruce,1,1) = 1 ";
				}
				else if(cruce == 'kio'){
					crucequery =  "AND substring(cruce,3,1) = 1 ";

				}
				else if(cruce == 'sisnkio'){
					crucequery =  "AND substring(cruce,1,1) = 1 AND substring(cruce,3,1) = 0 ";

				}
				else if(cruce == 'kionsis'){
					crucequery =  "AND substring(cruce,1,1) = 0 AND substring(cruce,3,1) = 1 ";

				}
			}
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")",
			userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")",
			
			fechaInicio = (req.query.inicio !== undefined && req.query.inicio !== '' ? new Date(req.query.inicio.replace('-','/')) : fechaActual()),
			dformatHourInicio = [fechaInicio.getFullYear(),(fechaInicio.getMonth()+1).padLeft(),
				fechaInicio.getDate().padLeft(),
				].join('-'),

			fechaFin = (req.query.fin !== undefined && req.query.fin !== '' ? new Date(req.query.fin.replace('-','/')) : fechaActual()),
			dformatHourFin = [fechaFin.getFullYear(),(fechaFin.getMonth()+1).padLeft(),
				fechaFin.getDate().padLeft(),
				].join('-'),
			thismonth = ('00' + (fechaInicio.getMonth()+1)).slice(-2),
			sql = "SELECT M.id_movimiento, M.fecha_peticion,M.id_cajero as id_cajero, C.nombre as cajero, M.valor_tx,M.secuencia, M.ref_recaudo,M.cruce, M.id_tipo_transaccion,T.nombre,M. M.fecha_retiro_valores, M.ajuste, M.fecha_negocio "
			+ "FROM ( SELECT * FROM movimiento_" + fechaInicio 	.getFullYear() + "" + thismonth + " ) AS M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red "
			+ "WHERE 1"
			+ userCompany + " " + userAdmin + " "
			+ "AND T.entrada_salida IN (1) "
			+ " "
			+ crucequery
			+ "AND id_tipo_resultado_tlf = 0 "
			+ (req.query.id_cajero !== '' && req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "'": '')
			+ "AND fecha_negocio >= '" + dformatHourInicio + "' AND fecha_negocio <= '" + dformatHourFin + "' "
			+ "ORDER BY id_cajero, fecha_retiro_valores;" ;
				console.log(sql);
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
				}
				else{
					res.status(200).json({'result':result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/totalesdia', function(req, res){	
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var fecha = fechas[0].inicial;
				var sql1 = "SELECT M.id_cajero as id_cajero, C.nombre as cajero, min(fecha_peticion) as inicio, max(fecha_peticion) as fin, G.nombre as geo, count(*) AS cantidad, "
				+ "sum(substring(billete_in,1,4)) as b1, "
				+ "sum(substring(billete_in,5,4)) as b2, "
				+ "sum(substring(billete_in,9,4)) as b3, "
				+ "sum(substring(billete_in,13,4)) as b4, "
				+ "sum(substring(billete_in,17,4)) as b5, "
				+ "sum(substring(billete_in,21,4)) as b6, "
				+ "sum(substring(billete_in,25,4)) as b7, "
				+ "sum(substring(moneda_in,1,4)) as c1, "
				+ "sum(substring(moneda_in,5,4)) as c2, "
				+ "sum(substring(moneda_in,9,4)) as c3, "
				+ "sum(substring(moneda_in,13,4)) as c4, "
				+ "sum(substring(moneda_in,17,4)) as c5, "
				+ "SUM(valor_tx) AS valor_tx, SUM (valor_comision) AS comision "
				+ "FROM movimiento_" + fecha.split('-')[0] + fecha.split('-')[1] + " M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia "
				+ "WHERE 1 "
				+ userCompany + " " + userAdmin + " "
				+ "AND T.entrada_salida = 1 "
				+ "AND substring(cruce,1,1) = 1 "
				+ "AND id_tipo_resultado_tlf = 0 "
				+ "AND fecha_negocio >= '" + fechas[0].inicial + "' "
				+ "AND fecha_negocio <= '" + fechas[0].final + "' "
				+ (req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "' " : "")
				+ (req.query.id_geografia !== undefined ? "AND G.id_geografia = '" + req.query.id_geografia + "' " : "")
				+ (req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" )
				+ (req.query.id_red !== undefined ? "AND C.id_red = '" + req.query.id_red + "' " : "")
				+ (req.query.id_administrador !== undefined ? "AND C.id_administrador = '" + req.query.id_administrador + "' " : "")
				+ (req.query.id_entidad !== undefined ? "AND M.id_entidad_autorizadora = '" + req.query.id_entidad + "' " : "")
				+ "GROUP BY id_cajero "
				+ "ORDER BY id_cajero;";
				dbConnection.query(sql1, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
				var d = fechaActual(),
			dformat = [d.getFullYear(),(d.getMonth()+1).padLeft(),
			d.getDate().padLeft(),
			].join('-') +' ' +
			[d.getHours().padLeft(),
			 d.getMinutes().padLeft(),
						   d.getSeconds().padLeft()].join(':');
			sql = "INSERT INTO registro_log (ws,id_usuario,fecha_registro, detalle) VALUES ('/totalesdia','" + req.user[0].id_usuario + "','" + dformat + "','Usuario consultó movimientos');";
				dbConnection.query(sql, (err, result) => {if(err) console.log(err + "Usuario consultó movimientos: " + id_usuario)})
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})

	/**
       * @api {post} /totalesdia Totales Dia
       * @apiName Totales Recaudo
       * @apiGroup Reportes
       *
	   * @apiParam {String} fecha_inicial Fecha inicial de la consulta.
	   * @apiParam {String} fecha_final Fecha final de la consulta.
	   * @apiParam {Integer} id_cajero Id del quiosco a consultar.
	   * @apiParam {String} id_geografia_padre Pais a consultar.
	   * @apiParam {String} id_geografia Ciudad a consultar.
	   * @apiParam {Integer} id_red Red a consultar.
	   * @apiParam {Integer} id_administrador Id del administrador a consultar.
	   * 
       * @apiSuccess {JSON} JSON Información con los totales de un día.
    */

	app.get('/totalesdia', function(req, res){	
		if(req.isAuthenticated()){
			fechasEventos(req.query.fecha_inicial, req.query.fecha_final, (fechas) => {
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
				var fecha = fechas[0].inicial;
				var sql1 = "SELECT M.id_cajero as id_cajero, C.nombre as cajero, min(fecha_peticion) as inicio, max(fecha_peticion) as fin, G.nombre as geo, count(*) AS cantidad, "
				+ "sum(substring(billete_in,1,4)) as b1, "
				+ "sum(substring(billete_in,5,4)) as b2, "
				+ "sum(substring(billete_in,9,4)) as b3, "
				+ "sum(substring(billete_in,13,4)) as b4, "
				+ "sum(substring(billete_in,17,4)) as b5, "
				+ "sum(substring(billete_in,21,4)) as b6, "
				+ "sum(substring(billete_in,25,4)) as b7, "
				+ "sum(substring(moneda_in,1,4)) as c1, "
				+ "sum(substring(moneda_in,5,4)) as c2, "
				+ "sum(substring(moneda_in,9,4)) as c3, "
				+ "sum(substring(moneda_in,13,4)) as c4, "
				+ "sum(substring(moneda_in,17,4)) as c5, "
				+ "SUM(valor_tx) AS valor_tx, SUM (valor_comision) AS comision "
				+ "FROM movimiento_" + fecha.split('-')[0] + fecha.split('-')[1] + " M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia "
				+ "WHERE 1 "
				+ userCompany + " " + userAdmin + " "
				+ "AND T.entrada_salida = 1 "
				+ "AND substring(cruce,1,1) = 1 "
				+ "AND id_tipo_resultado_tlf = 0 "
				+ "AND fecha_negocio >= '" + fechas[0].inicial + "' "
				+ "AND fecha_negocio <= '" + fechas[0].final + "' "
				+ (req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "' " : "")
				+ (req.query.id_geografia !== undefined ? "AND G.id_geografia = '" + req.query.id_geografia + "' " : "")
				+ (req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" )
				+ (req.query.id_red !== undefined ? "AND C.id_red = '" + req.query.id_red + "' " : "")
				+ (req.query.id_administrador !== undefined ? "AND C.id_administrador = '" + req.query.id_administrador + "' " : "")
				+ "GROUP BY id_cajero "
				+ "ORDER BY id_cajero;";
				//console.log(sql1);
				dbConnection.query(sql1, (err, result) => {
					if(err){
						console.log(err);
					}
					else{
						res.status(200).json({'result':result});
					}
				});
			});
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}		
	})
/**
       * @api {post} /saldokiosko Totales Dia
       * @apiName Saldo Quioscos
       * @apiGroup Reportes
       *
	   * @apiParam {Integer} id_cajero Id del quiosco a consultar.
	   * @apiParam {String} id_geografia_padre Pais a consultar.
	   * @apiParam {String} id_geografia Ciudad a consultar.
	   * @apiParam {Integer} id_red Red a consultar.
	   * @apiParam {Integer} id_administrador Id del administrador a consultar.
	   * 
       * @apiSuccess {JSON} JSON Información con los saldos de cada quiosco.
    */

	app.get('/saldokiosko', (req,res) => {
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ") ";

		if(req.isAuthenticated()){
			var fecha = fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
			var mesmenos1sep = ("00" + (fecha.getMonth() == 0? 12 : fecha.getMonth())).split('');
			var mesmenos1 = mesmenos1sep[mesmenos1sep.length-2] + '' + mesmenos1sep[mesmenos1sep.length-1]
			var aniomenos1 = fecha.getMonth() == 0? fecha.getFullYear() - 1: fecha.getFullYear(); 
			
			var sql = "SELECT M.id_cajero as id_cajero, C.nombre as cajero,min(fecha_peticion) as fecha_inicio, G.nombre as geo, count(*) AS cantidad, SUM(valor_tx) AS valor_tx, sum(substring(billete_in,1,4)) as mil, sum(substring(billete_in,5,4)) as 2_mil, sum(substring(billete_in,9,4)) as 5_mil, sum(substring(billete_in,13,4)) as 10_mil, sum(substring(billete_in,17,4)) as 20_mil, sum(substring(billete_in,21,4)) as 50_mil, sum(substring(billete_in,25,4)) as 100_mil " +
			"FROM(select * from movimiento_" + aniomenos1 + "" + mesmenos1 + "  UNION ALL select * from movimiento_" + fecha.getFullYear() + "" + mes + ") AS M " +
			"JOIN cajero C ON M.id_cajero = C.id_cajero " +
			"JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion  " +
			"JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia WHERE 1 " + userCompany + userAdmin +
			"AND T.entrada_salida in (1,3) AND M.fecha_retiro_valores is null AND M.Id_Tipo_Resultado_tlf = 0 AND SUBSTRING(cruce, 1, 1 ) =1 " +
			(req.query.id_cajero !== undefined ? "AND M.id_cajero = '" + req.query.id_cajero + "' " : "") + 
			(req.query.id_geografia !== undefined ? "AND G.id_geografia = '" + req.query.id_geografia + "' " : "") +
			(req.query.id_geografia_padre!== undefined? "AND G.id_geografia_padre = '" + req.query.id_geografia_padre + "'": "" ) +
			(req.query.id_red !== undefined ? "AND C.id_red = '" + req.query.id_red + "' " : "") +
			(req.query.id_administrador !== undefined ? "AND C.id_administrador = '" + req.query.id_administrador + "' " : "") +
			"GROUP BY M.id_cajero,M.id_tipo_transaccion " +
			"ORDER BY M.Id_cajero";
			//
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
				}
				else{
					res.status(200).json({'result':result});
				}
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/saldoacumulado', (req,res) => {
		var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
		var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ") ";

		if(req.isAuthenticated()){
			/*var fecha = fechaActual();
			var mesSep = ("00" + (fecha.getMonth()+1)).split('');
			var mes = mesSep[mesSep.length-2] + '' + mesSep[mesSep.length-1];
			var mesmenos1sep = ("00" + (fecha.getMonth() == 0? 12 : fecha.getMonth())).split('');
			var mesmenos1 = mesmenos1sep[mesmenos1sep.length-2] + '' + mesmenos1sep[mesmenos1sep.length-1]
			var aniomenos1 = fecha.getMonth() == 0? fecha.getFullYear() - 1: fecha.getFullYear(); 
			
			var sql = "SELECT M.id_cajero as id_cajero, C.nombre as cajero,min(fecha_peticion) as fecha_inicio, G.nombre as geo, count(*) AS cantidad, SUM(valor_tx) AS valor_tx, sum(substring(billete_in,1,4)) as mil, sum(substring(billete_in,5,4)) as 2_mil, sum(substring(billete_in,9,4)) as 5_mil, sum(substring(billete_in,13,4)) as 10_mil, sum(substring(billete_in,17,4)) as 20_mil, sum(substring(billete_in,21,4)) as 50_mil, sum(substring(billete_in,25,4)) as 100_mil " +
			"FROM(select * from movimiento_" + aniomenos1 + "" + mesmenos1 + " ) AS M " +
			"JOIN cajero C ON M.id_cajero = C.id_cajero " +
			"JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion  " +
			"JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia WHERE 1 " + userCompany + userAdmin +
			"AND T.entrada_salida in (1,3) AND M.fecha_retiro_valores is null AND M.Id_Tipo_Resultado_tlf = 0 AND SUBSTRING(cruce, 1, 1 ) = 1 " +
			"AND (fecha_retiro_valores is null OR fecha_retiro_valores > '" + fecha.getFullYear() + "-" + (fecha.getMonth()+1) + "-" + fecha.getDate() + " 00:00:00') " + 
			"GROUP BY M.id_cajero,M.id_tipo_transaccion " +
			"ORDER BY M.Id_cajero";*/
			//console.log(sql);

			const uno = 1;
			const fecha = new Date(req.query.fecha.replace('-','/')),
			mesActualSep = ("00" + (fecha.getMonth()+1)).split(''),
			mesActual = mesActualSep[mesActualSep.length-2] + '' + mesActualSep[mesActualSep.length-1],
			anioMesActual = fecha.getFullYear() + '' + mesActual,
			
			fechaActual = [fecha.getFullYear(),(fecha.getMonth()+1).padLeft(),
				fecha.getDate().padLeft(),
				].join('-'),

			mesAnteriorSep = ("00" + ( fecha.getMonth() == 0 ? 12: fecha.getMonth())).split(''),
			mesAnterior = mesAnteriorSep[mesAnteriorSep.length-2] + '' + mesAnteriorSep[mesAnteriorSep.length-1];
			anioMesAnterior = (fecha.getMonth() == 0 ? (fecha.getFullYear()-1) : fecha.getFullYear()) + '' + mesAnterior;

			mesDosAnteriorSep = ("00" + ( fecha.getMonth() == 0 ? 11: ( fecha.getMonth() == 1 ? 12 : fecha.getMonth()-1))).split(''),
			mesDosAnterior = mesDosAnteriorSep[mesDosAnteriorSep.length-2] + '' + mesDosAnteriorSep[mesDosAnteriorSep.length-1],
			anioMesDosAnterior = (fecha.getMonth() == 0 || fecha.getMonth() == 1 ? (fecha.getFullYear()-1) : fecha.getFullYear()) + '' + mesDosAnterior,

			primerDiaMes = [fecha.getFullYear(),(fecha.getMonth()+1).padLeft(),
				uno.padLeft(),
				].join('-'),

			/*console.log('yyyyMM', anioMesActual);
			console.log('yyyy-MM-dd', fechaActual);
			console.log('yyyyMM -1', anioMesAnterior);
			console.log('yyyyMM -2', anioMesDosAnterior);
			console.log('yyyy-MM-01', primerDiaMes);*/
			
			/*input = 2020-01-31*/
			sql = "SELECT " + 
			"kiosko, " +
			"SUM(CASE WHEN tipo = 'Entrada'  THEN valor ELSE 0 END) AS Entrada, " +
			"SUM(CASE WHEN tipo = 'Arqueo'  THEN valor ELSE 0 END) AS Arqueo, " +
			"SUM(CASE WHEN tipo = 'Arqueo del mes anterior'  THEN valor ELSE 0 END) AS Mes_Anterior, " +
			"SUM(CASE WHEN tipo = 'Saldo en Quiosco'  THEN valor ELSE 0 END) AS En_Quiosco " +
			
			/*Mes del input formato yyyymm*/ "FROM  (SELECT 'Entrada' as Tipo,fecha_negocio,id_cajero,kiosko,sum(valor_tx) as valor FROM View_" + anioMesActual + " " +
			"Where entrada_salida =1 " +
			(req.query.entidad !== null && req.query.entidad !== undefined && req.query.entidad !== '' ? "AND id_entidad_autorizadora = '" + req.query.entidad + "' " : '') + 
			/*fecha actualfecha del input yyyy-mm-dd*/"AND fecha_negocio <='" + fechaActual + "' " +
			"group by tipo,fecha_negocio,id_cajero " +
			"union all " +
			"Select 'Arqueo' as Tipo,fecha_negocio, A.id_cajero,CA.nombre as Kiosko,sum(valor_tx)as Valor  " +
			/*Mes del input formato yyyymm*/"from movimiento_" + anioMesActual + " as A " +
			"JOIN cajero CA ON A.id_cajero = CA.id_cajero " +
			"where id_tipo_transaccion = 901 " +
			/*fecha actualfecha del input yyyy-mm-dd*/"AND fecha_negocio <='" + fechaActual + "' " +
			"AND SUBSTRING(cruce, 1, 1 ) =1  " +
			"group by tipo,fecha_negocio,id_cajero " +
			"union all " +
			"SELECT 'Saldo en Quiosco' as tipo,fecha_negocio,M.id_cajero,C.nombre as Kiosko,sum(valor_tx) as valor " +
			/*Mes del input formato yyyymm*/"FROM(select * from movimiento_" + anioMesActual + " " +
			/*Mes anterior del input formato yyyymm*/"union all select * from movimiento_" + anioMesAnterior + " " +
			/*Dos meses atrás del input formato yyyymm*/"union all select * from movimiento_" + anioMesDosAnterior + ") AS M  " +
			"JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion   " +
			"JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia  " +
			"WHERE 1 AND T.entrada_salida in (1,3)  " +
			/*Fecha del input yyyy-mm-dd 23:59:59(fijo)*/"AND (M.fecha_retiro_valores is null or M.fecha_retiro_valores > '" + fechaActual + " 23:59:59') " +
			//Filtro por entidad
			"AND M.Id_Tipo_Resultado_tlf = 0  " +
			"AND SUBSTRING(cruce, 1, 1 ) =1  " +
			/*fecha del input yyyy-mm-dd*/"AND fecha_negocio <='" + fechaActual + "' " +
			"GROUP BY Tipo,fecha_negocio, M.id_cajero  " +
			"union all " +
			"SELECT 'Arqueo del mes anterior' as tipo,fecha_negocio,M.id_cajero,C.nombre as Kiosko,sum(valor_tx) as valor " +
			/*Mes anterior del input formato yyyymm*/ "FROM(select * from movimiento_" + anioMesAnterior + " " +
			/*Dos meses anteriores del input formato yyyymm*/"union all select * from movimiento_" + anioMesDosAnterior + ") AS M  " +
			"JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion  " + 
			"JOIN red R ON C.id_red = R.id_red JOIN geografia G ON C.id_geografia = G.id_geografia  " +
			"WHERE 1 AND T.entrada_salida in (1,3)  " +
			/*mes del input yyyy-mm-01 00:00:00 fijo*/"AND (M.fecha_retiro_valores is null or M.fecha_retiro_valores > '" + primerDiaMes + " 00:00:00') " +
			"AND M.Id_Tipo_Resultado_tlf = 0  " +
			"AND SUBSTRING(cruce, 1, 1 ) =1  " +
			/*fecha input yyyy-mm-dd*/ "AND fecha_negocio <='" + fechaActual + "' " +
			"GROUP BY Tipo,fecha_negocio, M.id_cajero ) As G " +
			"Group by kiosko";
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
				}
				else{
					res.status(200).json({'result':result});
				}
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	app.get('/detallefinmes', (req, res) => {
		if(req.isAuthenticated()){
			
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND C.id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND C.id_administrador IN(" + req.user[0].id_administrador + ")";
			
			var stringfecha = req.query.fecha,
			id_cajero = req.query.idcajero;
			
			var d = fecha = new Date(stringfecha.split('_').join(' ')),
			dformatHour = [d.getFullYear(),(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				].join('-') +' ' +
				[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':'),

			thismonth = ('00' + (fecha.getMonth()+1)).slice(-2);

			var sql = "SELECT M.Id_movimiento, M.fecha_peticion,M.id_cajero as id_cajero, C.nombre as cajero, M.Valor_Tx,M.Secuencia, M.ref_recaudo,M.cruce, M.id_tipo_transaccion,T.nombre,M. M.fecha_retiro_valores "
			+ "FROM ( SELECT * FROM movimiento_" + fecha.getFullYear() + "" + thismonth + " ) AS M JOIN cajero C ON M.id_cajero = C.id_cajero JOIN tipo_transaccion T ON M.id_tipo_transaccion = T.id_tipo_transaccion JOIN red R ON C.id_red = R.id_red "
			+ "WHERE 1"
			+ userCompany + " " + userAdmin + " "
			+ "AND T.entrada_salida IN (1) "
			+ "AND  (M.autorizacion <> '' OR M.autorizacion is not null) "
			+ "AND id_tipo_resultado_tlf = 0 "
			+ "AND fecha_peticion >= '" + dformatHour + "' AND (fecha_retiro_valores is null OR fecha_retiro_valores > '" + fecha.getFullYear() + "-" + (fecha.getMonth()+1) + "-" + fecha.getDate() + " 00:00:00') "
			+ "AND M.id_cajero = " + id_cajero + " "
			+ "ORDER BY id_cajero, fecha_retiro_valores;";
			//
			dbConnection.query(sql, (err, result) => {
				if(err){
					console.log(err);
				}
				else{
					res.status(200).json({'result':result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}	
	})

	/**
       * @api {post} /geografia Geografia
       * @apiName Geografia
       * @apiGroup Dashboard
       *
       * @apiSuccess {JSON} JSON Información de los paises y ciudades.
    */

	app.get('/geografia', (req,res)=>{
		if(req.isAuthenticated()){
			var sql = "SELECT id_pais, nombre_pais, id_ciudad, nombre_ciudad FROM ((SELECT nombre AS nombre_pais, id_geografia, id_geografia_padre FROM `geografia` WHERE id_geografia_padre = 0) AS t1 "+
			"INNER JOIN "+
			"(SELECT id_geografia AS id_ciudad, nombre AS nombre_ciudad, id_geografia_padre AS id_pais FROM geografia) AS t2 "+
			"ON t1.id_geografia = t2.id_pais)";
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	/**
       * @api {post} /administradores Administradores
       * @apiName Administradores
       * @apiGroup Dashboard
       *
       * @apiSuccess {JSON} JSON Información de los administradores.
    */

	app.get('/administradores', (req,res)=>{
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "SELECT id_administrador, nombre FROM administrador WHERE 1" + userCompany;
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	/**
       * @api {post} /tipousuariokiosko Tipo Usuario Kiosko
       * @apiName Tipo Usuario Kiosko
       * @apiGroup Dashboard
       *
       * @apiSuccess {JSON} JSON Información de los tipos de usuario en un quiosco.
    */

	app.get('/tipousuariokiosko', (req,res)=>{
		if(req.isAuthenticated()){
			var sql = "SELECT id_tipo_usuario_kiosko, nombre FROM tipo_usuario_kiosko WHERE 1" ;
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});
	
	/**
       * @api {post} /roles Roles
       * @apiName Roles
       * @apiGroup Dashboard
       *
       * @apiSuccess {JSON} JSON Información de los roles.
    */
	
	app.get('/rol4', (req, res) => {
		var sql = "SELECT * FROM rol_path WHERE id_rol = 4";
		//
		dbConnection.query(sql, (err, result) => {
			if(err) console.log(err);
			else{
				res.status(200).json({result:result});
			}
		})
	})

	app.get('/roles', (req,res)=>{
		if(req.isAuthenticated()){
			var sql = "SELECT * FROM rol WHERE 1 ";
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else {
					console.log(result);
					var encontrado = [];
					var response = result.forEach((element => {
						var permisos = element.permiso.split(',');
						permisos.forEach((permiso) => {
							if(permiso == req.user[0].rol_idrol){
								encontrado.push(element);
							};
						})
					}))
					//console.log(encontrado);

					res.status(200).json({'result':encontrado});
				}
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	/**
       * @api {post} /userexists Existe Usuario
       * @apiName Existe Usuario
       * @apiGroup Parametros
	   * 
	   * @apiParam {Integer} identificacion Cédula del usuario a buscar.
       *
       * @apiSuccess {JSON} JSON Información si existe un usuario con la cédula.
    */

	app.get('/userexists', function(req, res) {
		if(req.isAuthenticated()){
			if(req.user[0].rol_idrol == 1){
				var sql = "SELECT * FROM usuario WHERE identificacion_usuario = '" + req.query.identificacion + "';";
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}
			else{
				
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql = "Select distinct * FROM(select * from usuario where 1 " + userCompany + " " +
				"union ALL " + 
				"select * from usuario where 1 " + userAdmin + ") AS t1 WHERE  rol_idrol <> 1 AND identificacion_usuario = '" + req.query.identificacion + "'";
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}			
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /funcionarioexists Existe Funcionario
       * @apiName Existe Funcionario
       * @apiGroup Parametros
	   * 
	   * @apiParam {Integer} identificacion Cédula del funcionario a buscar.
       *
       * @apiSuccess {JSON} JSON Información si existe un funcionario con la cédula.
    */

	app.get('/funcionarioexists', function(req, res) {
		if(req.isAuthenticated()){
			//console.log(req.user[0].rol_idrol)
			if(req.user[0].rol_idrol == 1){
				var sql = "SELECT * FROM usuario_kiosko WHERE id_usuario_kiosko = '" + req.query.identificacion + "';";
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}
			else{
				
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql = "Select distinct * FROM(select * from usuario_kiosko where 1 " + userCompany + " " +
				"union ALL " + 
				"select * from usuario_kiosko where 1 " + userAdmin + ") AS t1 WHERE 1 AND id_usuario_kiosko = '" + req.query.identificacion + "'";

				//
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}			
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/cajeroexists', function(req, res) {
		if(req.isAuthenticated()){
			if(req.user[0].rol_idrol == 1){
				var sql = "SELECT * FROM cajero WHERE id_cajero = '" + req.query.id_cajero + "';";
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}
			else{
				
				var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
				var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
				var sql = "Select distinct * FROM(select * from cajero where 1 " + userCompany + " " +
				"union ALL " + 
				"select * from cajero where 1 " + userAdmin + ") AS t1 WHERE id_cajero = '" + req.query.id_cajero + "'";
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}			
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/eventoexists', function(req, res) {
		if(req.isAuthenticated()){
			if(req.user[0].rol_idrol == 1){
				var sql = "SELECT * FROM tipo_evento WHERE id_tipo_evento = '" +  + req.query.idevento +"';";
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}
			else{
				var sql = "SELECT * FROM tipo_evento WHERE id_rol LIKE  '%" + req.user[0].rol_idrol + "%' AND id_tipo_evento = '" +  + req.query.idevento +"';";
				dbConnection.query(sql, function(err, result){
					if(err) console.log(err);
					else {
						res.status(200).json({'result':result});
					}
				})
			}	
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/comisionexists', function(req, res) {
		if(req.isAuthenticated()){
			var sql = "SELECT * FROM comision WHERE id = '" +  + req.query.id +"';";
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else {
					res.status(200).json({'result':result});
				}
			})
			
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /usuarioporquiosco Usuario por Quiosco
       * @apiName Usuario por Quiosco
       * @apiGroup Dashboard
	   * 
       * @apiSuccess {JSON} JSON Información de la lista de usuarios asociados a un quiosco.
    */

	app.get('/usuarioporquiosco', (req, res) => {
		if(req.isAuthenticated()){

			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "Select * from usuario_kiosko Where 1" + userCompany + userAdmin;
			dbConnection.query(sql, (err, result) => {
				if(err) console.log(err);
				else{
					res.status(200).json({'result':result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	app.get('/usuarioporquiosco', (req, res) => {
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var userAdmin = req.user[0].id_administrador === '' ? '' : " AND id_administrador IN(" + req.user[0].id_administrador + ")";
			var sql = "Select * from usuario_kiosko WHERE 1 " + userCompany + userAdmin + ";";
			//
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else {
					res.status(200).json({'result':result});
				}
			})
		}
		else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	})

	/**
       * @api {post} /entidades Entidades
       * @apiName Entidades
       * @apiGroup Dashboard
	   * 
       * @apiSuccess {JSON} JSON Información de la lista de entidades.
    */
	app.get('/entidades', (req,res)=>{
		if(req.isAuthenticated()){
			var userCompany = req.user[0].id_entidad === '' ? '' : " AND id_entidad IN(" + req.user[0].id_entidad + ")";
			var sql = "SELECT id_entidad, nombre FROM entidad WHERE 1" + userCompany;
			dbConnection.query(sql, function(err, result){
				if(err) console.log(err);
				else res.status(200).json({'result':result});
			})
		} else{
			res.status(200).json({code:1,'message':'Auth required.'});
		}
	});

	}
	
	

	main();

    var port = process.env.PORT || 8081;

    var server = app.listen(port, function () {
        console.log('Server running at http://127.0.0.1:' + port + '/');
    });
}