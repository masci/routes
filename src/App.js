import React, { useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import html2canvas from "html2canvas";
import "./App.css";

function getFormattedDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return new Intl.DateTimeFormat("it-IT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function App() {
  // Spreadsheet configuration
  const idIndex = 6;
  const totalPltIndex = 26;
  const columnIndices = [18, 23, 26];
  const columnHeaders = ["Destinazione", "Codice prodotto", "Quantità"];

  // Date configuration
  const today = new Date();
  const formattedDate = getFormattedDate(today);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [sheetData, setSheetData] = useState({ idIndex: null, groups: [] });
  const [selectedDate, setSelectedDate] = useState(getFormattedDate(tomorrow));

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

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
            totalPlt: 0,
          };
          groupedData.push(currentGroup);
        }

        currentGroup.totalPlt += parseInt(row[totalPltIndex]) || 0;
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

    const zip = new JSZip();
    const exportContainer = document.getElementById("export-container");
    const driverGitaCounter = {};

    for (const group of sheetData.groups) {
      const driver = group.driverName;
      const gitaIndex = (driverGitaCounter[driver] || 0) + 1;
      driverGitaCounter[driver] = gitaIndex;

      const gitaContainer = document.createElement("div");
      gitaContainer.className = "group-container";
      gitaContainer.innerHTML = `
          <h2>Gita: ${group.id}  Autista: ${driver}</h2>
          <table class="table">
            <thead>
              <tr>
                ${columnHeaders.map((h) => `<th>${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${group.rows
                .map(
                  (row) => `
                <tr>
                  ${columnIndices
                    .map((colIndex) => `<td>${row[colIndex] || ""}</td>`)
                    .join("")}
                </tr>
              `,
                )
                .join("")}
              <tr>
                <td></td>
                <td></td>
                <td class="total">${group.totalPlt}</td>
              </tr>
              ${
                group.notes
                  ? `<tr><td colspan="3" class="notes">Note: ${group.notes}</td></tr>`
                  : ""
              }
            </tbody>
          </table>
        `;

      exportContainer.appendChild(gitaContainer);
      const canvas = await html2canvas(gitaContainer);
      const jpegBlob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg"),
      );
      zip.file(`${formattedDate}_${driver}_${gitaIndex}.jpeg`, jpegBlob);
      exportContainer.removeChild(gitaContainer);
    }

    // Generate a summary PDF with all entries
    const summaryDoc = new jsPDF();
    let summaryY = 15;
    summaryDoc.text(
      `Riepilogo gite del ${formatDate(selectedDate)}`,
      14,
      summaryY,
    );
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
      // Add the total number of plt
      body.push([
        "",
        "",
        { content: group.totalPlt, styles: { fontStyle: "bold" } },
      ]);
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
    zip.file(`riepilogo_${formattedDate}.pdf`, summaryPdfBlob);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${formattedDate}_gite.zip`;
    link.click();
  };

  return (
    <div className="App">
      <div
        id="export-container"
        style={{ position: "absolute", left: "-9999px" }}
      ></div>
      <header className="App-header">
        <h1>Gestione Gite</h1>
        <div className="controls">
          <input type="file" onChange={handleFileUpload} />
          <input
            type="date"
            id="date-input"
            value={selectedDate}
            onChange={handleDateChange}
          />
          <button onClick={handleExportToPdf}>Genera PDF</button>
        </div>
      </header>
      <div className="total-groups">
        <h3>
          Totale gite del {formatDate(selectedDate)}: {sheetData.groups.length}
        </h3>
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
                  <tr>
                    <td></td>
                    <td></td>
                    <td className="total">{group.totalPlt}</td>
                  </tr>
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
