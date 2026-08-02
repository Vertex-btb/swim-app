/**
 * AeroSwim - Google Sheets Database API (Deduplicated Merge Sync)
 * 
 * Instructions:
 * 1. In your Google Sheet, go to Extensions > Apps Script.
 * 2. Delete the old code and paste this script.
 * 3. CRITICAL: Change the API_KEY value below to your password.
 * 4. Save and deploy a "New Version" (Deploy > Manage deployments > edit > select "New Version" > Deploy).
 */

// CHANGE THIS to your own secret password / API key!
var API_KEY = "ChangeThisToYourSecretPassword123!";

// Helper to generate formatted Device-Id to pass USA Swimming API security checks
function generateDeviceId() {
  var now = new Date().getTime();
  var rawStr = "platform - vendor - unknown - " + now;
  var b64Str = Utilities.base64Encode(rawStr, Utilities.Charset.UTF_8);
  var deviceId = b64Str.slice(0, 15) + b64Str.slice(0, 5) + b64Str.slice(15);
  return deviceId;
}

// Handle GET requests (Reads all data dynamically based on headers)
function doGet(e) {
  try {
    var clientKey = e.parameter.key;
    if (clientKey !== API_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized. Invalid or missing API key." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Fetch Profile
    var profileSheet = getOrCreateSheet(ss, "Profile", ["Name", "Age", "Team"]);
    var profileData = profileSheet.getDataRange().getValues();
    var profile = { name: "Swimmer Name", age: 14, team: "Unattached" };
    if (profileData.length > 1) {
      var headers = profileData[0].map(normalizeHeader);
      var nameIdx = headers.indexOf("name");
      var ageIdx = headers.indexOf("age");
      var teamIdx = headers.indexOf("team");
      
      var row = profileData[1];
      if (nameIdx !== -1) profile.name = row[nameIdx] || profile.name;
      if (ageIdx !== -1) profile.age = parseInt(row[ageIdx]) || profile.age;
      if (teamIdx !== -1) profile.team = row[teamIdx] || profile.team;
    }
    
    // 2. Fetch Swim Log
    var timesSheet = getOrCreateSheet(ss, "Swim Log", ["Date", "Location", "Event", "Course", "Time"]);
    var timesData = timesSheet.getDataRange().getValues();
    var times = [];
    if (timesData.length > 1) {
      var headers = timesData[0].map(normalizeHeader);
      var idIdx = headers.indexOf("id");
      var dateIdx = headers.indexOf("date");
      var locIdx = headers.indexOf("location");
      var eventIdx = headers.indexOf("event");
      var courseIdx = headers.indexOf("course");
      var timeIdx = headers.indexOf("time");
      
      for (var i = 1; i < timesData.length; i++) {
        var row = timesData[i];
        
        var dateVal = dateIdx !== -1 ? formatDate(row[dateIdx]) : "";
        var eventVal = eventIdx !== -1 ? row[eventIdx].toString().trim() : "";
        var timeVal = timeIdx !== -1 ? formatTimeCell(row[timeIdx]) : "";
        
        if (!dateVal || !eventVal || !timeVal) continue;
        
        times.push({
          id: idIdx !== -1 ? row[idIdx].toString() : ("t_" + i),
          date: dateVal,
          location: locIdx !== -1 ? row[locIdx].toString() : "Unknown Meet",
          event: eventVal,
          course: courseIdx !== -1 ? row[courseIdx].toString().toUpperCase() : "SCY",
          time: timeVal
        });
      }
    }
    
    // 3. Fetch Workouts
    var workoutsSheet = getOrCreateSheet(ss, "Workouts", ["Date", "Distance", "Focus", "Duration", "Details", "Notes", "Id"]);
    var workoutsData = workoutsSheet.getDataRange().getValues();
    var workouts = [];
    if (workoutsData.length > 1) {
      var headers = workoutsData[0].map(normalizeHeader);
      var idIdx = headers.indexOf("id");
      var dateIdx = headers.indexOf("date");
      var distIdx = headers.indexOf("distance");
      var focusIdx = headers.indexOf("focus");
      var durIdx = headers.indexOf("duration");
      var detIdx = headers.indexOf("details");
      var notesIdx = headers.indexOf("notes");
      
      for (var i = 1; i < workoutsData.length; i++) {
        var row = workoutsData[i];
        var dateVal = dateIdx !== -1 ? formatDate(row[dateIdx]) : "";
        if (!dateVal) continue;
        
        workouts.push({
          id: idIdx !== -1 ? row[idIdx].toString() : ("w_" + i),
          date: dateVal,
          distance: distIdx !== -1 ? parseInt(row[distIdx]) || 0 : 0,
          focus: focusIdx !== -1 ? row[focusIdx].toString() : "Endurance",
          duration: durIdx !== -1 ? parseInt(row[durIdx]) || 0 : 0,
          details: detIdx !== -1 ? row[detIdx].toString() : "",
          notes: notesIdx !== -1 ? row[notesIdx].toString() : ""
        });
      }
    }
    
    // 4. Fetch Nutrition
    var nutritionSheet = getOrCreateSheet(ss, "Nutrition", ["Date", "Breakfast", "Lunch", "Dinner", "Snacks", "Calories", "WaterCups"]);
    var nutritionData = nutritionSheet.getDataRange().getValues();
    var nutritionHistory = {};
    if (nutritionData.length > 1) {
      var headers = nutritionData[0].map(normalizeHeader);
      var dateIdx = headers.indexOf("date");
      var bkIdx = headers.indexOf("breakfast");
      var lnIdx = headers.indexOf("lunch");
      var dnIdx = headers.indexOf("dinner");
      var snIdx = headers.indexOf("snacks");
      var calIdx = headers.indexOf("calories");
      var waterIdx = headers.indexOf("watercups");
      
      for (var i = 1; i < nutritionData.length; i++) {
        var row = nutritionData[i];
        var dateVal = dateIdx !== -1 ? formatDate(row[dateIdx]) : "";
        if (!dateVal) continue;
        
        nutritionHistory[dateVal] = {
          waterCups: waterIdx !== -1 ? parseInt(row[waterIdx]) || 0 : 0,
          meals: {
            breakfast: bkIdx !== -1 ? row[bkIdx].toString() : "",
            lunch: lnIdx !== -1 ? row[lnIdx].toString() : "",
            dinner: dnIdx !== -1 ? row[dnIdx].toString() : "",
            snacks: snIdx !== -1 ? row[snIdx].toString() : ""
          },
          calories: calIdx !== -1 ? parseInt(row[calIdx]) || 0 : 0
        };
      }
    }
    
    var responseData = {
      profile: profile,
      times: times,
      workouts: workouts,
      nutrition: { history: nutritionHistory }
    };
    
    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests (Writes dynamically based on sheet headers)
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.key !== API_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized. Invalid API key." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = payload.action;
    
    if (action === "saveProfile") {
      var sheet = getOrCreateSheet(ss, "Profile", ["Name", "Age", "Team"]);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
      
      var row = [];
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] === "name") row.push(payload.data.name);
        else if (headers[i] === "age") row.push(payload.data.age);
        else if (headers[i] === "team") row.push(payload.data.team);
        else row.push("");
      }
      
      sheet.clearContents();
      sheet.appendRow(sheet.getRange(1, 1, 1, headers.length).getValues()[0] || ["Name", "Age", "Team"]); 
      sheet.appendRow(row);
      
    } else if (action === "addTime") {
      var sheet = getOrCreateSheet(ss, "Swim Log", ["Date", "Location", "Event", "Course", "Time"]);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
      
      var row = [];
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] === "id") row.push(payload.data.id);
        else if (headers[i] === "date") row.push(payload.data.date);
        else if (headers[i] === "location") row.push(payload.data.location);
        else if (headers[i] === "event") row.push(payload.data.event);
        else if (headers[i] === "course") row.push(payload.data.course);
        else if (headers[i] === "time") row.push(payload.data.time);
        else row.push("");
      }
      sheet.appendRow(row);
      
    } else if (action === "updateTime") {
      var sheet = getOrCreateSheet(ss, "Swim Log", ["Date", "Location", "Event", "Course", "Time"]);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
      var idCol = headers.indexOf("id");
      
      if (idCol === -1) {
        var row = [];
        for (var i = 0; i < headers.length; i++) {
          if (headers[i] === "date") row.push(payload.data.date);
          else if (headers[i] === "location") row.push(payload.data.location);
          else if (headers[i] === "event") row.push(payload.data.event);
          else if (headers[i] === "course") row.push(payload.data.course);
          else if (headers[i] === "time") row.push(payload.data.time);
          else row.push("");
        }
        sheet.appendRow(row);
      } else {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][idCol].toString() === payload.data.id.toString()) {
            for (var j = 0; j < headers.length; j++) {
              var h = headers[j];
              var cellVal = "";
              if (h === "date") cellVal = payload.data.date;
              else if (h === "location") cellVal = payload.data.location;
              else if (h === "event") cellVal = payload.data.event;
              else if (h === "course") cellVal = payload.data.course;
              else if (h === "time") cellVal = payload.data.time;
              else continue;
              sheet.getRange(i + 1, j + 1).setValue(cellVal);
            }
            break;
          }
        }
      }
      
    } else if (action === "deleteTime") {
      var sheet = getOrCreateSheet(ss, "Swim Log", ["Date", "Location", "Event", "Course", "Time"]);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
      var idCol = headers.indexOf("id");
      if (idCol !== -1) {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][idCol].toString() === payload.id.toString()) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
      
    } else if (action === "saveAllTimes") {
      var sheet = getOrCreateSheet(ss, "Swim Log", ["Date", "Location", "Event", "Course", "Time"]);
      var originalHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var headers = originalHeaders.map(normalizeHeader);
      
      sheet.clearContents();
      sheet.appendRow(originalHeaders); 
      
      for (var k = 0; k < payload.data.length; k++) {
        var entry = payload.data[k];
        var row = [];
        for (var j = 0; j < headers.length; j++) {
          var h = headers[j];
          if (h === "id") row.push(entry.id || ("t_" + k));
          else if (h === "date") row.push(entry.date);
          else if (h === "location") row.push(entry.location);
          else if (h === "event") row.push(entry.event);
          else if (h === "course") row.push(entry.course);
          else if (h === "time") row.push(entry.time);
          else row.push("");
        }
        sheet.appendRow(row);
      }
      
    } else if (action === "importUsaSwimmingTimes") {
      var usasId = payload.data.usasId;
      var deviceId = generateDeviceId();
      var url = "https://times-api.usaswimming.org/swims/TimesSearch/GetBestTimesForMember/" + usasId;
      
      var options = {
        method: "get",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Device-Id": deviceId,
          "AppName": "DataHub",
          "Usas-Sub-Id": "Anonymous"
        },
        muteHttpExceptions: true
      };
      
      var response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() !== 200) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "USA Swimming returned error " + response.getResponseCode() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var bestTimes = JSON.parse(response.getContentText());
      var sheet = getOrCreateSheet(ss, "Swim Log", ["Date", "Location", "Event", "Course", "Time"]);
      
      // Read existing rows to prevent duplicates
      var existingData = sheet.getDataRange().getValues();
      var existingMap = {};
      var headers = existingData[0].map(normalizeHeader);
      var eventCol = headers.indexOf("event");
      var courseCol = headers.indexOf("course");
      var timeCol = headers.indexOf("time");
      
      for (var r = 1; r < existingData.length; r++) {
        var key = existingData[r][eventCol] + "_" + existingData[r][courseCol] + "_" + formatTimeCell(existingData[r][timeCol]);
        existingMap[key] = true;
      }
      
      var todayStr = formatDate(new Date());
      
      for (var k = 0; k < bestTimes.length; k++) {
        var bt = bestTimes[k];
        
        var strokeMap = {
          "freestyle": "free",
          "backstroke": "back",
          "breaststroke": "breast",
          "butterfly": "fly",
          "individual medley": "IM"
        };
        var strokeLower = bt.strokeName.toLowerCase();
        var mappedStroke = strokeMap[strokeLower] || strokeLower;
        var eventCode = bt.distance + "-" + mappedStroke;
        
        var timeFormatted = bt.swimTime.toString().trim();
        var checkKey = eventCode + "_" + bt.courseCode + "_" + timeFormatted;
        
        // Only append if it does not already exist
        if (!existingMap[checkKey]) {
          var row = [];
          for (var j = 0; j < headers.length; j++) {
            var h = headers[j];
            if (h === "id") row.push("t_imported_" + bt.swimTimeRecognitionId);
            else if (h === "date") row.push(todayStr);
            else if (h === "location") row.push("USA Swimming Official PR");
            else if (h === "event") row.push(eventCode);
            else if (h === "course") row.push(bt.courseCode);
            else if (h === "time") row.push(timeFormatted);
            else row.push("");
          }
          sheet.appendRow(row);
        }
      }
      
      // Try to update profile automatically!
      var memberUrl = "https://times-api.usaswimming.org/swims/TimesSearch/GetMember/" + usasId;
      var memberRes = UrlFetchApp.fetch(memberUrl, options);
      if (memberRes.getResponseCode() === 200) {
        var memberData = JSON.parse(memberRes.getContentText());
        var profSheet = getOrCreateSheet(ss, "Profile", ["Name", "Age", "Team"]);
        profSheet.clearContents();
        profSheet.appendRow(["Name", "Age", "Team"]);
        profSheet.appendRow([memberData.shortName || memberData.fullName, memberData.swimmerAge, memberData.clubName]);
      }
      
    } else if (action === "addWorkout") {
      var sheet = getOrCreateSheet(ss, "Workouts", ["Date", "Distance", "Focus", "Duration", "Details", "Notes", "Id"]);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
      
      var row = [];
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] === "id") row.push(payload.data.id);
        else if (headers[i] === "date") row.push(payload.data.date);
        else if (headers[i] === "distance") row.push(payload.data.distance);
        else if (headers[i] === "focus") row.push(payload.data.focus);
        else if (headers[i] === "duration") row.push(payload.data.duration);
        else if (headers[i] === "details") row.push(payload.data.details);
        else if (headers[i] === "notes") row.push(payload.data.notes);
        else row.push("");
      }
      sheet.appendRow(row);
      
    } else if (action === "deleteWorkout") {
      var sheet = getOrCreateSheet(ss, "Workouts", ["Date", "Distance", "Focus", "Duration", "Details", "Notes", "Id"]);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
      var idCol = headers.indexOf("id");
      if (idCol !== -1) {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][idCol].toString() === payload.id.toString()) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
      
    } else if (action === "saveNutrition") {
      var sheet = getOrCreateSheet(ss, "Nutrition", ["Date", "Breakfast", "Lunch", "Dinner", "Snacks", "Calories", "WaterCups"]);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
      var dateCol = headers.indexOf("date");
      
      if (dateCol !== -1) {
        var data = sheet.getDataRange().getValues();
        var foundRow = -1;
        for (var i = 1; i < data.length; i++) {
          if (formatDate(data[i][dateCol]) === payload.date) {
            foundRow = i + 1;
            break;
          }
        }
        
        var row = [];
        for (var j = 0; j < headers.length; j++) {
          var h = headers[j];
          if (h === "date") row.push(payload.date);
          else if (h === "breakfast") row.push(payload.data.meals.breakfast);
          else if (h === "lunch") row.push(payload.data.meals.lunch);
          else if (h === "dinner") row.push(payload.data.meals.dinner);
          else if (h === "snacks") row.push(payload.data.meals.snacks);
          else if (h === "calories") row.push(payload.data.calories);
          else if (h === "watercups") row.push(payload.data.waterCups);
          else row.push("");
        }
        
        if (foundRow !== -1) {
          sheet.getRange(foundRow, 1, 1, headers.length).setValues([row]);
        } else {
          sheet.appendRow(row);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Utility Helpers ---

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    if (lastCol === 0 || lastRow === 0) {
      sheet.clear();
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function normalizeHeader(h) {
  return h.toString().trim().toLowerCase().replace(/\s+/g, "");
}

function formatDate(val) {
  if (val instanceof Date) {
    var year = val.getFullYear();
    var month = ("0" + (val.getMonth() + 1)).slice(-2);
    var day = ("0" + val.getDate()).slice(-2);
    return year + "-" + month + "-" + day;
  }
  var dateStr = val.toString().trim();
  if (dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }
  return dateStr;
}

function formatTimeCell(val) {
  if (val instanceof Date) {
    var hours = val.getHours();
    var minutes = val.getMinutes();
    var seconds = val.getSeconds();
    var ms = val.getMilliseconds();
    
    var timeStr = "";
    if (minutes > 0 || hours > 0) {
      var totalMin = (hours * 60) + minutes;
      timeStr += totalMin.toString() + ":";
    }
    timeStr += ("0" + seconds).slice(-2) + "." + (ms / 10).toFixed(0).padStart(2, '0');
    return timeStr;
  }
  return val.toString().trim();
}
