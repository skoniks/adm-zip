var fs = require("fs"),
    pth = require('path');

var ZipEntry = require("./zipEntry"),
    ZipFile =  require("./zipFile"),
    Utils = require("./util");

module.exports = function(/*String*/inPath) {
    var _zip = undefined,
        _filename = "";

    if (inPath && typeof inPath === "string") { // load zip file
        if (pth.existsSync(inPath)) {
            _filename = inPath;
            console.log(require("util").inspect(process.memoryUsage()));
            _zip = new ZipFile(fs.readFileSync(inPath));
        } else {
           throw Utils.Errors.INVALID_FILENAME;
        }
    } else { // create new zip file
        _zip = new ZipFile();
    }

    function getEntry(/*Object*/entry) {
        if (entry && _zip) {
            var item;
            // If entry was given as a file name
            if (typeof entry === "string")
                item = _zip.getEntry(entry);
            // if entry was given as a ZipEntry object
            if (typeof entry === "object" && entry.entryName != undefined && entry.header != undefined)
                item =  _zip.getEntry(entry.entryName);

            if (item) {
                return item;
            }
        }
        return null;
    }

    process.on('uncaughtException', function (err) {
        console.log('Caught exception: ' + err);
    });

    return {
        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param entry ZipEntry object or String with the full path of the entry
         *
         * @return Buffer or Null in case of error
         */
        readFile : function(/*Object*/entry) {
            var item = getEntry(entry);
            return item && item.data || null;
        },
        /**
         * Asyncronous readFile
         * @param entry ZipEntry object or String with the full path of the entry
         * @param callback
         *
         * @return Buffer or Null in case of error
         */
        readFileAsync : function(/*Object*/entry, /*Function*/callback) {
            var item = getEntry(entry);
            if (item) {
                item.getData(callback);
            } else {
                callback(null)
            }
        },
        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param entry ZipEntry object or String with the full path of the entry
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText : function(/*Object*/entry, /*String - Optional*/encoding) {
            var item = getEntry(entry);
            if (item) {
                var data = item.data;
                if (data && data.length) {
                    return data.toString(encoding || "utf8");
                }
            }
            return "";
        },
        /**
         * Asyncronous readAsText
         * @param entry ZipEntry object or String with the full path of the entry
         * @param callback
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsTextAsync : function(/*Object*/entry, /*Function*/callback, /*String - Optional*/encoding) {
            var item = getEntry(entry);
            if (item) {
                item.getData(function(data) {
                    if (data && data.length) {
                        callback(data.toString(encoding || "utf8"));
                    }
                })
            } else {
                callback("");
            }
        },

        deleteFile : function(/*Object*/entry) {
            var item = getEntry(entry);
            if (item) {
                _zip.deleteEntry(item.entryName);
            }
        },

        addZipComment : function(/*String*/comment) {
            _zip.comment = comment;
        },

        getZipComment : function() {
            return _zip.comment;
        },

        addZipEntryComment : function(/*Object*/entry,/*String*/comment) {
            var item = getEntry(entry);
            if (item) {
                item.comment = comment;
            }
        },

        getZipEntryComment : function(/*Object*/entry) {
            var item = getEntry(entry);
            if (item) {
                return item.comment;
            }
            return ''
        },

        updateFile : function(/*Object*/entry, /*Buffer*/content) {
            var item = getEntry(entry);
            if (item) {
                item.data = content;
            }
        },

        addLocalFile : function(/*String*/localPath) {
             if (pth.existsSync(localPath)) {
                  // do stuff
             } else {
                 throw Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath);
             }
        },

        addLocalFolder : function(/*String*/localPath) {
            if (pth.existsSync(localPath)) {
                // do stuff
            } else {
                throw Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath);
            }
        },

        addFile : function(/*String*/entryName, /*Buffer*/content, /*String*/comment, /*Number*/attr) {
            var entry = new ZipEntry();
            entry.entryName = entryName;
            entry.comment = comment || "";
            entry.attr = attr || 0666;
            if (entry.isDirectory && content.length) {
                throw Utils.Errors.DIRECTORY_CONTENT_ERROR;
            }
            entry.data = content;
            entry.header.time = new Date();
            _zip.setEntry(entry);
        },

        /**
         * Returns an array of ZipEntry objects representing the files and folders inside the archive
         *
         * @return Array
         */
        getEntries : function() {
            if (_zip) {
               return _zip.entries;
            } else {
                return [];
            }
        },

        getEntry : function(/*String*/name) {
            return getEntry(name);
        },

        /**
         * Extracts the given entry to the given targetPath
         * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
         *
         * @param entry ZipEntry object or String with the full path of the entry
         * @param targetPath Target folder where to write the file
         * @param maintainEntryPath If maintainEntryPath is true and the entry is inside a folder, the entry folder
         *                          will be created in targetPath as well. Default is TRUE
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         *
         * @return Boolean
         */
        extractEntryTo : function(/*Object*/entry, /*String*/targetPath, /*Boolean*/maintainEntryPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;
            maintainEntryPath = typeof maintainEntryPath == "undefned" ? true : maintainEntryPath;

            var item = getEntry(entry);
            if (!item) {
                throw Utils.Errors.NO_ENTRY;
            }

            var target = pth.resolve(targetPath, maintainEntryPath ? item.entryName : pth.basename(item.entryName));

            if (item.isDirectory) {
                target = pth.resolve(target, "..");
                var children = _zip.getEntryChildren(item);
                children.forEach(function(child) {
                    if (child.isDirectory) return;
                    var content = child.data;
                    if (!content) throw Utils.Errors.CANT_EXTRACT_FILE;
                    Utils.writeFileTo(pth.resolve(targetPath, maintainEntryPath ? child.entryName : child.entryName.substr(item.entryName.length)), content, overwrite);
                })
            }

            var content = item.data;
            if (!content) throw Utils.Errors.CANT_EXTRACT_FILE;

            if (pth.existsSync(targetPath) && !overwrite) {
                throw Utils.Errors.CANT_OVERRIDE;
            }
            Utils.writeFileTo(target, content, overwrite);

            return true;
        },

        /**
         * Extracts the entire archive to the given location
         *
         * @param targetPath Target location
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         */
        extractAllTo : function(/*String*/targetPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;
            if (!_zip) {
                throw Utils.Errors.NO_ZIP;
            }

            _zip.entries.forEach(function(entry) {
                 if (entry.isDirectory) return;
                var content = entry.data;
                if (!content) throw Utils.Errors.CANT_EXTRACT_FILE;
                Utils.writeFileTo(pth.resolve(targetPath, entry.entryName), content, overwrite);
            })
        },

        writeZip : function(/*String*/targetFileName) {
            if (!targetFileName) return;
            var zipData = _zip.toBuffer();
            if (zipData) {
                Utils.writeFileTo(targetFileName, zipData, true);
            }
        },

        toBuffer : function() {
            return _zip.toBuffer()
        }
    }
};