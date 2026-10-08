interface IncidentComment {
  author: string;
  createdAt: string;
  text: string;
}

// Existing reports store the description followed by stamped user comments.
// Keep legacy text without attribution in the description rather than guessing its author.
export function splitIncidentContent(notes: string): {
  description: string;
  comments: IncidentComment[];
} {
  const headers = Array.from(notes.matchAll(
    /\r?\n\r?\n([^\r\n]+) · (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\r?\n/g
  )).filter(match => Number.isFinite(Date.parse(match[2])));
  return {
    description: headers.length ? notes.slice(0, headers[0].index) : notes,
    comments: headers.map((header, index) => ({
      author: header[1],
      createdAt: header[2],
      text: notes.slice(header.index! + header[0].length, headers[index + 1]?.index ?? notes.length),
    })),
  };
}

export function formatIncidentCommentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
