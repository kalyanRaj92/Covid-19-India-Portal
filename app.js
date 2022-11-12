const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
let database = null;

const initializeAndDbAndServer = async () => {
  try {
    database = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log(`server is running on http://localhost:3000/`);
    });
  } catch (error) {
    console.log(`Database error is ${error}`);
    process.exit(1);
  }
};
initializeAndDbAndServer();

//                           API 1
//                         User Login
// get JWT token using jsonwebtoken package
// const JWTToken = jwt.sign(payload,'own_secret_key');
// payload is user information
//     Scenarios
// 1)Invalid user
//  2)Invalid password
//  3) Return the JWT Token
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  // check user
  const userDetailsQuery = `select * from user where username = '${username}';`;
  const userDetails = await database.get(userDetailsQuery);
  if (userDetails !== undefined) {
    const isPasswordValid = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordValid) {
      //get JWT Token
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "vivek_secret_key");
      response.send({ jwtToken }); //Scenario 3
    } else {
      response.status(400);
      response.send(`Invalid password`); //Scenario 2
    }
  } else {
    response.status(400);
    response.send("Invalid user"); //Scenario 1
  }
});

//            Authentication with Token
//    Scenarios
//1) If the token is not provided by the user or an invalid token-->Invalid JWT Token
// 2) After successful verification of token proceed to next middleware or handler
// get JWT token from headers and validate using jwt.verify
//jwt.verify(jwtToken , 'secret key given above' , callback function)

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "vivek_secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`); // Scenario 1
      } else {
        next(); //Scenario 2
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`); //Scenario 1
  }
}

//                           API 2
//Returns a list of all states in the state table
// get the results if the user has authentication
const convertStateDbObject = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};
app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `select * from state;`;
  const getStates = await database.all(getStatesQuery);
  response.send(getStates.map((eachState) => convertStateDbObject(eachState)));
});

//                                       API 3
// Returns a state based on the state ID
// only authenticated users get the details

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `select * from state where state_id = ${stateId};`;
  const getStateDetails = await database.get(getStateDetailsQuery);
  response.send(convertStateDbObject(getStateDetails));
});

//                    API 4
//Create a district in the district table, district_id is auto-incremented
// only authenticated users can post the data

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) 
  values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const createDistrict = await database.run(createDistrictQuery);
  response.send(`District Successfully Added`);
});

//            API 5
//Returns a district based on the district ID
const convertDbObjectDistrict = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictByIdQuery = `select * from district where district_id=${districtId};`;
    const getDistrictByIdQueryResponse = await database.get(
      getDistrictByIdQuery
    );
    response.send(convertDbObjectDistrict(getDistrictByIdQueryResponse));
  }
);

//----------------------API 6
//Deletes a district from the district table based on the district ID
// only authenticated users can delete data from database.

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id = ${districtId};`;
    const deleteDistrict = await database.run(deleteDistrictQuery);
    response.send(`District Removed`);
  }
);

//                                API 7
//Updates the details of a specific district based on the district ID
// only authenticated users can update the data.
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `update district set
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} where district_id = ${districtId};`;

    const updateDistrictQueryResponse = await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//                             API 8
//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateByIDStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured,
    sum(active) as totalActive , sum(deaths) as totalDeaths from district where state_id = ${stateId};`;

    const getStateByIDStatsQueryResponse = await database.get(
      getStateByIDStatsQuery
    );
    response.send(getStateByIDStatsQueryResponse);
  }
);

module.exports = app;

// //ANSWER
// const express = require("express");
// const { open } = require("sqlite");
// const sqlite3 = require("sqlite3");
// const path = require("path");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");

// const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

// const app = express();

// app.use(express.json());

// let database = null;

// const initializeDbAndServer = async () => {
//   try {
//     database = await open({
//       filename: databasePath,
//       driver: sqlite3.Database,
//     });

//     app.listen(3000, () =>
//       console.log("Server Running at http://localhost:3000/")
//     );
//   } catch (error) {
//     console.log(`DB Error: ${error.message}`);
//     process.exit(1);
//   }
// };

// initializeDbAndServer();

// const convertStateDbObjectToResponseObject = (dbObject) => {
//   return {
//     stateId: dbObject.state_id,
//     stateName: dbObject.state_name,
//     population: dbObject.population,
//   };
// };

// const convertDistrictDbObjectToResponseObject = (dbObject) => {
//   return {
//     districtId: dbObject.district_id,
//     districtName: dbObject.district_name,
//     stateId: dbObject.state_id,
//     cases: dbObject.cases,
//     cured: dbObject.cured,
//     active: dbObject.active,
//     deaths: dbObject.deaths,
//   };
// };

// function authenticateToken(request, response, next) {
//   let jwtToken;
//   const authHeader = request.headers["authorization"];
//   if (authHeader !== undefined) {
//     jwtToken = authHeader.split(" ")[1];
//   }
//   if (jwtToken === undefined) {
//     response.status(401);
//     response.send("Invalid JWT Token");
//   } else {
//     jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
//       if (error) {
//         response.status(401);
//         response.send("Invalid JWT Token");
//       } else {
//         next();
//       }
//     });
//   }
// }

// app.post("/login/", async (request, response) => {
//   const { username, password } = request.body;
//   const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
//   const databaseUser = await database.get(selectUserQuery);
//   if (databaseUser === undefined) {
//     response.status(400);
//     response.send("Invalid user");
//   } else {
//     const isPasswordMatched = await bcrypt.compare(
//       password,
//       databaseUser.password
//     );
//     if (isPasswordMatched === true) {
//       const payload = {
//         username: username,
//       };
//       const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
//       response.send({ jwtToken });
//     } else {
//       response.status(400);
//       response.send("Invalid password");
//     }
//   }
// });

// app.get("/states/", authenticateToken, async (request, response) => {
//   const getStatesQuery = `
//     SELECT
//       *
//     FROM
//       state;`;
//   const statesArray = await database.all(getStatesQuery);
//   response.send(
//     statesArray.map((eachState) =>
//       convertStateDbObjectToResponseObject(eachState)
//     )
//   );
// });

// app.get("/states/:stateId/", authenticateToken, async (request, response) => {
//   const { stateId } = request.params;
//   const getStateQuery = `
//     SELECT
//       *
//     FROM
//       state
//     WHERE
//       state_id = ${stateId};`;
//   const state = await database.get(getStateQuery);
//   response.send(convertStateDbObjectToResponseObject(state));
// });

// app.get(
//   "/districts/:districtId/",
//   authenticateToken,
//   async (request, response) => {
//     const { districtId } = request.params;
//     const getDistrictsQuery = `
//     SELECT
//       *
//     FROM
//      district
//     WHERE
//       district_id = ${districtId};`;
//     const district = await database.get(getDistrictsQuery);
//     response.send(convertDistrictDbObjectToResponseObject(district));
//   }
// );

// app.post("/districts/", authenticateToken, async (request, response) => {
//   const { stateId, districtName, cases, cured, active, deaths } = request.body;
//   const postDistrictQuery = `
//   INSERT INTO
//     district (state_id, district_name, cases, cured, active, deaths)
//   VALUES
//     (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`;
//   await database.run(postDistrictQuery);
//   response.send("District Successfully Added");
// });

// app.delete(
//   "/districts/:districtId/",
//   authenticateToken,
//   async (request, response) => {
//     const { districtId } = request.params;
//     const deleteDistrictQuery = `
//   DELETE FROM
//     district
//   WHERE
//     district_id = ${districtId}
//   `;
//     await database.run(deleteDistrictQuery);
//     response.send("District Removed");
//   }
// );

// app.put(
//   "/districts/:districtId/",
//   authenticateToken,
//   async (request, response) => {
//     const { districtId } = request.params;
//     const {
//       districtName,
//       stateId,
//       cases,
//       cured,
//       active,
//       deaths,
//     } = request.body;
//     const updateDistrictQuery = `
//   UPDATE
//     district
//   SET
//     district_name = '${districtName}',
//     state_id = ${stateId},
//     cases = ${cases},
//     cured = ${cured},
//     active = ${active},
//     deaths = ${deaths}
//   WHERE
//     district_id = ${districtId};
//   `;

//     await database.run(updateDistrictQuery);
//     response.send("District Details Updated");
//   }
// );

// app.get(
//   "/states/:stateId/stats/",
//   authenticateToken,
//   async (request, response) => {
//     const { stateId } = request.params;
//     const getStateStatsQuery = `
//     SELECT
//       SUM(cases),
//       SUM(cured),
//       SUM(active),
//       SUM(deaths)
//     FROM
//       district
//     WHERE
//       state_id=${stateId};`;
//     const stats = await database.get(getStateStatsQuery);
//     response.send({
//       totalCases: stats["SUM(cases)"],
//       totalCured: stats["SUM(cured)"],
//       totalActive: stats["SUM(active)"],
//       totalDeaths: stats["SUM(deaths)"],
//     });
//   }
// );

// module.exports = app;
