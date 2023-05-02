import React, { useState } from "react";
import QRCode from "qrcode";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import "./App.css";

pdfMake.vfs = pdfFonts.pdfMake.vfs;

const App = () => {
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [xmlData, setXmlData] = useState("");
  const [Ln, setLn] = useState("");
  const [Dn, setDn] = useState("");
  const [phone, setPhone] = useState("");

  const generateQrCodes = async () => {
    setLoading(true);

    const sets = xmlData.match(/<set[^>]*>(.*?)<\/set>/gs);
    const headMatch = xmlData.match(/<[^>]+>/);

    const head = headMatch && headMatch[0];
    const lnMatch = head.match(/LN="(.*?)"/);
    const ln = lnMatch && lnMatch[1];
    const dnMatch = head.match(/DN="(.*?)"/);
    const dn = dnMatch && dnMatch[1];
    setLn(ln);
    setDn(dn);

    if (!sets) {
      setLoading(false);
      return;
    }

    const qrCodes = [];

    for (let i = 0; i < sets.length; i += 10) {
      const setIdMatch = sets[i].match(/SetNumber="(.*?)"/);
      const imp = sets[i].match(/IMP="(.*?)"/);
      const setId = setIdMatch && setIdMatch[1];

      const blockData = [];

      for (let j = i; j < i + 10; j++) {
        if (!sets[j]) {
          break;
        }

        const set = sets[j];
        const setIdMatch = set.match(/SetNumber="(.*?)"/);
        const setId = setIdMatch && setIdMatch[1];
        const blocksMatch = set.match(/<Block\d+\s+[^>]*>/g);

        const setBlocksData = blocksMatch
          .map((block) => {
            const blockValues = block.match(/RG="(.*?)"/);
            const rg = blockValues && blockValues[1];
            const agMatch = block.match(/AG="(.*?)"/);
            const ag = agMatch && agMatch[1];

            const paddedRg =
              rg &&
              rg
                .split(",")
                .map((r) => (parseInt(r) < 10 ? `0${r}` : r))
                .join(",");
            const paddedAg = ag && (parseInt(ag) < 10 ? `0${ag}` : ag);

            return `,${paddedRg},${paddedAg}`;
          })
          .join("");

        let start =
          ln === "USMM" || ln === "TMM"
            ? "MD1JC"
            : ln === "TMJJ"
            ? "MD1JCB4S"
            : ln === "USPB" || ln === "TPB"
            ? "PD1JC"
            : ln === "TL"
            ? "LD1JC"
            : ln === "TLX"
            ? "LD1JC"
            : ln === "TWO"
            ? "SD1S"
            : ln === "C5"
            ? "CD1K0S"
            : "X";

        let mid =
          imp[1] === "True" || ln === "TLX"
            ? "MYS"
            : ln === "TMJJ"
            ? ""
            : imp[1] === "False"
            ? "MNS"
            : "";

        blockData.push({
          setId: setId,
          data: setBlocksData.replace(",", ""),
          lotData: `LOT21:W${start}${mid}${setBlocksData.replace(",", "")}\n`,
        });
      }

      const qrCodeData =
        setId && blockData.map((block) => block.lotData).join("");

      const qrCodeImage = await QRCode.toDataURL(
        qrCodeData.replace(/,/g, "").replace(/http:/g, ""),
        { noSymbol: true }
      );

      qrCodes.push({
        qrCode: qrCodeImage,
        setsData: blockData,
      });
    }

    setLoading(false);
    setQrCodes(qrCodes);
  };

  const generatePdf = (viewPdf) => {
    const fileName = `${Ln}-${Dn}-Set-${qrCodes[0].setsData[0].setId}-${
      qrCodes[qrCodes.length - 1].setsData[
        qrCodes[qrCodes.length - 1].setsData.length - 1
      ].setId
    }.pdf`;

    const docDefinition = {
      info: {
        title: fileName,
        author: "Your Name",
      },
      content: qrCodes
        .map((qrCodeData) => {
          const setId = qrCodeData.setsData[0].setId;
          const lastSetId =
            qrCodeData.setsData[qrCodeData.setsData.length - 1].setId;
          const titleText = `${Ln} ${Dn}\nSet ${setId}-${lastSetId}`;

          const qrCodeSection = {
            stack: [
              { text: titleText, style: "title" },
              {
                image: qrCodeData.qrCode,
                width: 200,
                alignment: "center",
                margin: [0, 10],
              },
            ],
            pageBreak: "after",
          };

          const setDataSection = {
            table: {
              dontBreakRows: true,
              headerRows: 1,
              widths: ["auto", "*"],
              body: [
                [
                  { text: "Set ID", style: "tableHeader", width: "auto" },
                  { text: "Data", style: "tableHeader", width: "*" },
                ],
                ...qrCodeData.setsData.map(({ setId, data }) => [
                  { text: setId, style: "tableCell", width: "auto" },
                  {
                    text: addNewlines(data),
                    style: "tableCell",
                    width: "*",
                  },
                ]),
              ],
            },
            layout: {
              defaultBorder: false,
              hLineWidth: (i, node) => {
                return i === 0 || i === node.table.body.length ? 0 : 1;
              },
              fillColor: function (rowIndex) {
                return rowIndex % 2 === 0 ? "#EEEEEE" : null;
              },
              vLineWidth: (i, node) => {
                return 0;
              },
              hLineColor: (i, node) => {
                return i === 0 || i === node.table.body.length
                  ? "transparent"
                  : "#ccc";
              },
              paddingLeft: (i, node) => {
                return i === 0 ? 5 : 5;
              },
              paddingRight: (i, node) => {
                return i === 0 ? 5 : 0;
              },
              paddingTop: (i, node) => {
                return i === 0 ? 5 : 2;
              },
              paddingBottom: (i, node) => {
                return i === node.table.body.length - 1 ? 5 : 2;
              },
            },
            pageBreak: "after",
          };

          return [qrCodeSection, setDataSection];
        })
        .flat(),
      styles: {
        title: {
          fontSize: 18,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 10],
        },
        tableHeader: {
          bold: true,
          fillColor: "#EEEEEE",
          fontSize: 16,
        },
        tableCell: {
          margin: [5, 2, 5, 2],
          fontSize: 16,
          wordBreak: "break-all",
        },
      },
    };

    if (viewPdf) {
      pdfMake.createPdf(docDefinition).open();
    } else {
      pdfMake.createPdf(docDefinition).download(fileName);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const fileContents = reader.result;
      setXmlData(fileContents);
    };
    reader.readAsText(file);
  };

  function openForm() {
    document.getElementById("myForm").style.display = "block";
  }

  function closeForm() {
    document.getElementById("myForm").style.display = "none";
  }

  function sendWhatsApp(event) {
    event.preventDefault();
    let url = "https://wa.me/" + phone.replace(/\D/g, "");

    window.open(url);
  }

  function addNewlines(str) {
    let result = "";
    for (let i = 0; i < str.length; i++) {
      result += str[i];
      if ((i + 1) % 60 === 0) {
        result += "\n";
      }
    }
    return result;
  }

  return (
    <div class="main-container">
      <h1>XML to QrCode Converter</h1>
      <div className="btnContainer">
        <label class="upload">
          Upload XML file
          <input
            type="file"
            accept=".xml"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>
        <button
          class="generate-qrcodes"
          onClick={generateQrCodes}
          disabled={!xmlData || loading}
        >
          <span class="generate-qrcodes-text">
            {loading ? "Generating..." : "Generate QR Codes"}
          </span>
        </button>
        <button
          class="generate-pdf"
          onClick={() => {
            generatePdf(true);
          }}
          disabled={!qrCodes.length}
        >
          View PDF
        </button>
        <button
          class="generate-pdf"
          disabled={!qrCodes.length}
          onClick={() => {
            generatePdf(false);
          }}
        >
          Download PDF
        </button>
        {loading && <p class="loading">Generating QR codes, please wait...</p>}
      </div>

      <div class="container">
        <button class="floating-btn" onClick={openForm}>
          Whatsapp 📞
        </button>
        <div class="form-popup" id="myForm">
          <form class="form-container">
            <h3>Send a Message</h3>
            <label for="phone">
              <b>Phone Number</b>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              onChange={(event) => setPhone(event.target.value)}
            />

            <button type="submit" class="btn" onClick={sendWhatsApp}>
              Send
            </button>
            <button type="button" class="btn cancel" onClick={closeForm}>
              Close
            </button>
          </form>
        </div>
      </div>

      {qrCodes.length > 0 && (
        <div class="qrcodes-container">
          {qrCodes.map(({ qrCode }, index) => (
            <img
              key={index}
              src={qrCode}
              alt={`QR code ${index}`}
              class="qrcode"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
