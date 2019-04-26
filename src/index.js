const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const log = require('log');

const fsExtended = module.exports = {
	touch: function(file){
		fs.closeSync(fs.openSync(file, 'w'));
	},
	move: function(oldPath, newPath, cb){
		fs.rename(oldPath, newPath, function(err){
			if(err){
				if(err.code === 'EXDEV') fsExtended.copy(oldPath, newPath, cb);

				else cb(err);

				return;
			}

			cb();
		});
	},
	copy: function(oldPath, newPath, cb){
		var readStream = fs.createReadStream(oldPath);
		var writeStream = fs.createWriteStream(newPath);

		readStream.on('error', cb);
		writeStream.on('error', cb);

		readStream.on('close', function(){
			fs.unlink(oldPath, cb);
		});

		readStream.pipe(writeStream);
	},
	copySync: function(source, target){
		log.info(1)('copy', source, target);

		if(fs.existsSync(target) && fs.lstatSync(target).isDirectory()) target = path.join(target, path.basename(source));

		fs.writeFileSync(target, fs.readFileSync(source));
	},
	copyRecursiveSync: function(source, target){
		target = path.join(target, path.basename(source));

		if(!fs.existsSync(target)) fs.mkdirSync(target);

		if(fs.lstatSync(source).isDirectory()){
			fs.readdirSync(source).forEach(function(file){
				var curSource = path.join(source, file);

				if(fs.lstatSync(curSource).isDirectory()) fsExtended.copyRecursiveSync(curSource, target);

				else fsExtended.copySync(curSource, target);
			});
		}
	},
	copyRecursivePattern: function(source, target, pattern){
		fs.readdirSync(path.resolve(source)).forEach(function(fileName){
			if(!pattern.test(fileName)) return;

			var resolvedPath = path.resolve(source, fileName);

			fsExtended['copy'+ (fs.lstatSync(resolvedPath).isDirectory() ? 'RecursivePattern' : 'Sync')](resolvedPath, target, pattern);
		});
	},
	rm: function(filePath){
		log(1)(`Removing file: ${filePath}`);

		try{ fs.unlinkSync(filePath); }

		catch(err){
			if(err.code !== 'ENOENT') return log.error(err);

			log.warn(1)(`Can't remove ${filePath}, doesn't exist`);
		}
	},
	rmPattern: function(rootPath, pattern){
		fs.readdirSync(path.resolve(rootPath)).forEach(function(fileName){
			if(!pattern.test(fileName)) return;

			var resolvedPath = path.resolve(rootPath, fileName);

			fsExtended['rm'+ (fs.lstatSync(resolvedPath).isDirectory() ? 'dir' : '')](resolvedPath);
		});
	},
	rmdir: function(dir){
		if(!fs.existsSync(dir)) return;

		log(1)(`Removing directory: ${dir}`);

		fs.readdirSync(dir).forEach(function(file){
			var curPath = dir +'/'+ file;

			if(fs.lstatSync(curPath).isDirectory()) fsExtended.rmdir(curPath);

			else fs.unlinkSync(curPath);
		});

		fs.rmdirSync(dir);
	},
	mkdir: function(dir){
		if(!dir) return;

		log(1)(`Creating directory: ${dir}`);

		for(var x = dir.length - 2; x >= 0; --x){
			if(dir.charAt(x) === '/' || dir.charAt(x) === path.sep){
				fsExtended.mkdir(dir.slice(0, x));

				break;
			}
		}

		try{ fs.mkdirSync(dir); }

		catch(err){
			if(err.code !== 'EEXIST') return log.error()(dir, err);

			log.warn(1)(`Can't make ${dir}, already exists`);
		}
	},
	cat: function(filePath, cb){
		fs.readFile(filePath, 'utf8', function(err, data){
			if(err) log.error(err);

			cb(data || '');
		});
	},
	catSync: function(filePath){
		var fileData;

		try{ fileData = fs.readFileSync(filePath, 'utf8'); }

		catch(err){
			if(err.code !== 'ENOENT') return log.error(err);

			log.warn(1)(`Can't read ${filePath}, doesn't exist`);

			fileData = '';
		}

		return fileData;
	},
	isDirectory: function(src){
		return fs.lstatSync(src).isDirectory();
	},
	browse: function(dir, cb){
		var output = { folders: [], files: [] };

		fs.readdir(dir, function(err, files){
			for(var x = 0, count = files.length; x < count; ++x){
				files[x] = path.join(dir, files[x]);

				output[fsExtended.isDirectory(files[x]) ? 'folders' : 'files'].push(files[x]);
			}

			cb(output);
		});
	},
	getFileHash: function(src, done){
		var fileData = fs.createReadStream(src);
		var hash = crypto.createHash('sha1');

		hash.setEncoding('hex');

		fileData.on('error', function(err){
			log.error('ERR getFileHash ERR', err);

			hash.end();

			done(hash.read());
		});

		fileData.on('end', function(){
			hash.end();

			done(hash.read());
		});

		fileData.pipe(hash);
	},
	checksum: function(text){
		return text ? crypto.createHash('sha1').update(text, 'utf8').digest('hex') : 'error';
	}
};