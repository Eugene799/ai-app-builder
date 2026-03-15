import JSZip from "jszip";

export async function downloadFilesAsZip(appName: string, files: Array<{ path: string; content: string }>) {
  const zip = new JSZip();
  
  files.forEach((file) => {
    zip.file(file.path, file.content);
  });
  
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${appName.toLowerCase().replace(/\s+/g, "-")}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
