import React, { useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import "./App.css";

function App() {
  const [sheetData, setSheetData] = useState({ idIndex: null, groups: [] });
  // Spreadsheet configuration
  const idIndex = 6;
  const columnIndices = [18, 23, 26];
  const columnHeaders = ["Destinazione", "Codice prodotto", "Quantità"];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const [, ...rows] = jsonData;

      let groupedData = [];
      let currentGroup = null;

      for (const row of rows) {
        const id = row[idIndex];
        if (!id) {
          continue;
        }

        if (!currentGroup || currentGroup.id !== id) {
          currentGroup = {
            id: id,
            rows: [],
            driverName: "",
            notes: "",
          };
          groupedData.push(currentGroup);
        }

        currentGroup.rows.push(row);
      }

      setSheetData({ idIndex, groups: groupedData });
    };
    reader.readAsBinaryString(file);
  };

  const handleInputChange = (e, groupIndex, field) => {
    const { value } = e.target;
    setSheetData((prevData) => {
      const updatedGroups = [...prevData.groups];
      updatedGroups[groupIndex] = {
        ...updatedGroups[groupIndex],
        [field]: value,
      };
      return { ...prevData, groups: updatedGroups };
    });
  };

  const handleExportToPdf = async () => {
    if (sheetData.groups.length === 0) {
      alert("Nessuna gita presente. Importa un file Excel prima.");
      return;
    }

    const hasMissingDriver = sheetData.groups.some(
      (group) => !group.driverName,
    );
    if (hasMissingDriver) {
      alert("Assegna un autista a tutte le gite prima di esportare in PDF.");
      return;
    }

    const groupsByDriver = sheetData.groups.reduce((acc, group) => {
      const driver = group.driverName;
      if (!acc[driver]) {
        acc[driver] = [];
      }
      acc[driver].push(group);
      return acc;
    }, {});

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;

    const zip = new JSZip();

    for (const driver in groupsByDriver) {
      const doc = new jsPDF();
      let y = 15;

      groupsByDriver[driver].forEach((group) => {
        doc.text(`Gita: ${group.id}  Autista: ${driver}`, 14, y);
        y += 2;
        const body = group.rows.map((row) =>
          columnIndices.map((colIndex) => row[colIndex]),
        );
        if (group.notes) {
          body.push([
            {
              content: `Note: ${group.notes}`,
              colSpan: 4,
              styles: { fontStyle: "italic", halign: "center" },
            },
          ]);
        }
        autoTable(doc, {
          startY: y,
          head: [columnHeaders],
          body: body,
        });
        y = doc.lastAutoTable.finalY + 10;
      });

      const pdfBlob = doc.output("blob");
      zip.file(`${formattedDate}_${driver}.pdf`, pdfBlob);
    }

    // Generate a summary PDF with all entries
    const summaryDoc = new jsPDF();
    let summaryY = 15;
    summaryDoc.text("Riepilogo Generale Gite", 14, summaryY);
    summaryY += 10;

    for (const group of sheetData.groups) {
      summaryDoc.text(
        `Gita: ${group.id}  Autista: ${group.driverName || "Non Assegnato"}`,
        14,
        summaryY,
      );
      summaryY += 2;
      const body = group.rows.map((row) =>
        columnIndices.map((colIndex) => row[colIndex]),
      );
      if (group.notes) {
        body.push([
          {
            content: `Note: ${group.notes}`,
            colSpan: 4,
            styles: { fontStyle: "italic", halign: "center" },
          },
        ]);
      }
      autoTable(summaryDoc, {
        startY: summaryY,
        head: [columnHeaders],
        body: body,
      });
      summaryY = summaryDoc.lastAutoTable.finalY + 10;
    }

    const summaryPdfBlob = summaryDoc.output("blob");
    zip.file(`all_entries_${formattedDate}.pdf`, summaryPdfBlob);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${formattedDate}_gite.zip`;
    link.click();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Gestione Gite</h1>
        <div className="controls">
          <input type="file" onChange={handleFileUpload} />
          <button onClick={handleExportToPdf}>Genera PDF</button>
        </div>
      </header>
      <div className="total-groups">
        <h3>Totale gite: {sheetData.groups.length}</h3>
      </div>
      <>
        <div className="table-container">
          {sheetData.groups.map((group, index) => (
            <div key={index} className="group-container">
              <h2>Gita: {group.id}</h2>
              <div className="group-inputs">
                <input
                  type="text"
                  name="driver-name"
                  placeholder="Driver Name"
                  value={group.driverName || ""}
                  onChange={(e) => handleInputChange(e, index, "driverName")}
                />
                <input
                  type="text"
                  name="notes"
                  placeholder="Notes"
                  value={group.notes || ""}
                  onChange={(e) => handleInputChange(e, index, "notes")}
                />
              </div>
              <table className="table">
                <thead>
                  <tr>
                    {columnHeaders.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, i) => (
                    <tr key={i}>
                      {columnIndices.map((colIndex, j) =>
                        colIndex !== -1 ? (
                          <td key={j}>{row[colIndex]}</td>
                        ) : null,
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </>
    </div>
  );
}

export default App;
