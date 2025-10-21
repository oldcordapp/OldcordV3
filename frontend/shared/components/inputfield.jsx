import "./inputfield.css";

export default function ({
  label,
  id,
  placeholder,
  required,
  type,
  style,
  value,
  maxLength=1250,
  onChange
}) {

  const isTextarea = type === 'textarea';

  const commonProps = {
    id: id,
    placeholder: placeholder,
    required: required,
    value: value,
    onChange: onChange,
    className: "input-field"
  };

return (
    <div className="input-container" style={style}>
      <label className="input-label" htmlFor={id}>{label} {required ? (<span className="required-text">(Required)</span>) : <></>}</label>
      
      {isTextarea ? (
        <textarea 
          {...commonProps} 
          style={{ minHeight: '150px', padding: '10px', resize: 'vertical' }} maxLength={maxLength}
        ></textarea>
      ) : (
        <input 
          {...commonProps} 
          type={type} maxLength={maxLength} 
        />
      )}
    </div>
  );
}
