import { labels } from "../lib/reports";
export default function ChoiceGroup({ legend, options, value, onChange }) {
  return (
    <fieldset className="choice-group">
      <legend>{legend}</legend>
      <div className="choices">
        {options.map((option) => (
          <label
            key={option}
            className={`choice ${value === option ? "selected" : ""}`}
          >
            <input
              type="radio"
              name={legend}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{labels[option] || option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
