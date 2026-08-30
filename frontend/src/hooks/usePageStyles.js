import { useLayoutEffect } from "react";

export default function usePageStyles(fileName) {
  useLayoutEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/styles/${fileName}`;
    link.dataset.pageStyle = fileName;
    document.head.appendChild(link);

    return () => link.remove();
  }, [fileName]);
}
