export default function Footer() {
  return (
    <div className="foot">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div>
          <b>ExamPath</b> &mdash; every exam, every date, one place.
        </div>
        <div className="small">
          Data compiled from official sources. Always verify on the official
          website. Not a government website.
        </div>
      </div>
    </div>
  );
}
