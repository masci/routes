import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";

function App() {
  const [sheetData, setSheetData] = useState({ idIndex: null, groups: [] });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const [header, ...rows] = jsonData;
      const idIndex = header.indexOf("Id");

      if (idIndex === -1) {
        alert('Column "Id" not found!');
        return;
      }

      let groupedData = [];
      let currentGroup = null;

      for (const row of rows) {
        const id = row[idIndex];
        if (id) {
          if (!currentGroup || currentGroup.id !== id) {
            currentGroup = {
              id: id,
              mainTableRows: [],
              subTableHeader: null,
              subTableRows: [],
            };
            groupedData.push(currentGroup);
          }
          currentGroup.mainTableRows.push(row);
        } else {
          if (currentGroup) {
            if (!currentGroup.subTableHeader) {
              currentGroup.subTableHeader = row;
              const desiredColumns = [
                "Assortimenti",
                "Nome del punto",
                "# ordini",
                "Scarico pallet",
              ];
              currentGroup.subTableHeaderIndices = desiredColumns.map((col) =>
                row.indexOf(col),
              );
            } else {
              currentGroup.subTableRows.push(row);
            }
          }
        }
      }

      setSheetData({ idIndex, groups: groupedData });
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Spreadsheet Viewer</h1>
        <input type="file" onChange={handleFileUpload} />
      </header>
      <div className="table-container">
        {sheetData.groups.map((group, index) => (
          <div key={index}>
            <h2>Group: {group.id}</h2>
            {group.subTableHeader && (
              <table className="table">
                <thead>
                  <tr>
                    {[
                      "Assortimenti",
                      "Nome del punto",
                      "# ordini",
                      "Scarico pallet",
                    ].map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.subTableRows.map((row, i) => (
                    <tr key={i}>
                      {group.subTableHeaderIndices.map((colIndex, j) =>
                        colIndex !== -1 ? (
                          <td key={j}>{row[colIndex]}</td>
                        ) : null,
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
