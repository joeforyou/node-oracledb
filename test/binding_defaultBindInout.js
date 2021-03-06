/* Copyright (c) 2017, 2018 Oracle and/or its affiliates. All rights reserved. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * The node-oracledb test suite uses 'mocha', 'should' and 'async'.
 * See LICENSE.md for relevant licenses.
 *
 * NAME
 *   101. binding_defaultBindInout.js
 *
 * DESCRIPTION
 *   This suite tests the data binding, including:
 *     Test cases test bind inout oracledb type STRING/BUFFER to all db column types using plsql procedure and function
 *     The cases use default bind type and dir.
 *     The cases take null bind values.
 *
 *****************************************************************************/
'use strict';

var oracledb = require('oracledb');
var should   = require('should');
var async    = require('async');
var sql      = require('./sql.js');
var dbConfig = require('./dbconfig.js');

describe('101.binding_defaultBindInout.js', function() {
  this.timeout(5000);
  var connection = null;
  var executeSql = function(sql, callback) {
    connection.execute(
      sql,
      function(err) {
        should.not.exist(err);
        return callback();
      }
    );
  };

  before(function(done) {
    oracledb.getConnection(dbConfig, function(err, conn) {
      should.not.exist(err);
      connection = conn;
      done();
    });
  });

  after(function(done) {
    connection.release( function(err) {
      should.not.exist(err);
      done();
    });
  });

  var doTest1 = function(table_name, procName, bindType, dbColType, content, sequence, callback) {
    async.series([
      function(cb) {
        var bindVar = {
          i: sequence,
          c: content
        };
        inBind1(table_name, procName, dbColType, bindVar, bindType, cb);
      },
      function(cb) {
        var bindVar =[ sequence, content ];
        inBind1(table_name, procName, dbColType, bindVar, bindType, cb);
      }
    ], callback);
  };

  var inBind1 = function(table_name, proc_name, dbColType, bindVar, bindType, callback) {
    var createTable = sql.createTable(table_name, dbColType);
    var drop_table = "DROP TABLE " + table_name + " PURGE";
    var proc = "CREATE OR REPLACE PROCEDURE " + proc_name + " (ID IN NUMBER, inValue IN OUT " + dbColType + ")\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into " + table_name + " ( id, content ) values (ID, inValue); \n" +
               "    select content into inValue from " + table_name + " where id = ID; \n" +
               "END " + proc_name + "; ";
    var sqlRun = "BEGIN " + proc_name + " (:i, :c); END;";
    var proc_drop = "DROP PROCEDURE " + proc_name;
    // console.log(proc);
    async.series([
      function(cb) {
        executeSql(createTable, cb);
      },
      function(cb) {
        executeSql(proc, cb);
      },
      function(cb) {
        connection.execute(
          sqlRun,
          bindVar,
          function(err) {
            compareErrMsg(dbColType, err);
            cb();
          }
        );
      },
      function(cb) {
        executeSql(proc_drop, cb);
      },
      function(cb) {
        executeSql(drop_table, cb);
      }
    ], callback);
  };

  var doTest2 = function(table_name, procPre, bindType, dbColType, content, sequence, callback) {
    async.series([
      function(cb) {
        var bindVar = {
          i: sequence,
          c: content,
          output: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        };
        inBind2(table_name, procPre, dbColType, bindVar, bindType, cb);
      },
      function(cb) {
        var bindVar =[ { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }, sequence, content ];
        inBind2(table_name, procPre, dbColType, bindVar, bindType, cb);
      }
    ], callback);
  };

  var inBind2 = function(table_name, fun_name, dbColType, bindVar, bindType, callback) {
    var createTable = sql.createTable(table_name, dbColType);
    var drop_table = "DROP TABLE " + table_name + " PURGE";
    var proc = "CREATE OR REPLACE FUNCTION " + fun_name + " (ID IN NUMBER, inValue IN OUT " + dbColType + ") RETURN NUMBER\n" +
               "IS \n" +
               "    tmpvar NUMBER; \n" +
               "BEGIN \n" +
               "    insert into " + table_name + " ( id, content ) values (ID, inValue); \n" +
               "    select id, content into tmpvar, inValue from " + table_name + " where id = ID; \n" +
               "    RETURN tmpvar; \n" +
               "END ; ";
    var sqlRun = "BEGIN :output := " + fun_name + " (:i, :c); END;";
    var proc_drop = "DROP FUNCTION " + fun_name;
    // console.log(proc);
    async.series([
      function(cb) {
        executeSql(createTable, cb);
      },
      function(cb) {
        executeSql(proc, cb);
      },
      function(cb) {
        connection.execute(
          sqlRun,
          bindVar,
          function(err) {
            compareErrMsg(dbColType, err);
            cb();
          }
        );
      },
      function(cb) {
        executeSql(proc_drop, cb);
      },
      function(cb) {
        executeSql(drop_table, cb);
      }
    ], callback);
  };

  var compareErrMsg = function(element, err) {
    if(element === "BLOB") {
      // ORA-06550: line 1, column 7:
      // PLS-00306: wrong number or types of arguments in call to 'NODB_INBIND_XX'
      // ORA-06550: line 1, column 7:
      // PL/SQL: Statement ignored
      (err.message).should.startWith('ORA-06550:');
    } else {
      should.not.exist(err);
    }
  };

  var tableNamePre = "table_101";
  var procPre = "proc_101";
  var index = 1;

  describe('101.1 PLSQL procedure: bind out null value with default type and dir', function() {

    it('101.1.1 oracledb.STRING <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "NUMBER";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.2 oracledb.STRING <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "CHAR";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.3 oracledb.STRING <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "NCHAR";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.4 oracledb.STRING <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "VARCHAR2";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.5 oracledb.STRING <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "FLOAT";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.6 oracledb.STRING <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_FLOAT";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.7 oracledb.STRING <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_DOUBLE";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.8 oracledb.STRING <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "DATE";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.9 oracledb.STRING <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "TIMESTAMP";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.10 oracledb.STRING <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "RAW";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.11 oracledb.STRING <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "CLOB";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.12 oracledb.STRING <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BLOB";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.13 oracledb.BUFFER <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "NUMBER";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.14 oracledb.BUFFER <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "CHAR";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.15 oracledb.BUFFER <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "NCHAR";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.16 oracledb.BUFFER <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "VARCHAR2";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.17 oracledb.BUFFER <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "FLOAT";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.18 oracledb.BUFFER <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_FLOAT";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.19 oracledb.BUFFER <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_DOUBLE";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.20 oracledb.BUFFER <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "DATE";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.21 oracledb.BUFFER <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "TIMESTAMP";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.22 oracledb.BUFFER <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "RAW";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.23 oracledb.BUFFER <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "CLOB";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.1.24 oracledb.BUFFER <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BLOB";

      doTest1(table_name, proc_name, bindType, dbColType, content, index, done);
    });
  });

  describe('101.2 PLSQL function: bind out null value with default type and dir', function() {

    it('101.2.1 oracledb.STRING <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "NUMBER";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.2 oracledb.STRING <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "CHAR";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.3 oracledb.STRING <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "NCHAR";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.4 oracledb.STRING <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "VARCHAR2";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.5 oracledb.STRING <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "FLOAT";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.6 oracledb.STRING <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_FLOAT";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.7 oracledb.STRING <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_DOUBLE";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.8 oracledb.STRING <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "DATE";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.9 oracledb.STRING <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "TIMESTAMP";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.10 oracledb.STRING <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "RAW";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.11 oracledb.STRING <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "CLOB";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.12 oracledb.STRING <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BLOB";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.13 oracledb.BUFFER <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "NUMBER";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.14 oracledb.BUFFER <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "CHAR";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.15 oracledb.BUFFER <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "NCHAR";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.16 oracledb.BUFFER <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "VARCHAR2";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.17 oracledb.BUFFER <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "FLOAT";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.18 oracledb.BUFFER <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_FLOAT";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.19 oracledb.BUFFER <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_DOUBLE";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.20 oracledb.BUFFER <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "DATE";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.21 oracledb.BUFFER <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "TIMESTAMP";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.22 oracledb.BUFFER <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "RAW";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.23 oracledb.BUFFER <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "CLOB";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });

    it('101.2.24 oracledb.BUFFER <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BLOB";

      doTest2(table_name, proc_name, bindType, dbColType, content, index, done);
    });
  });

});
