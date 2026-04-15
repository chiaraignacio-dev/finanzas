import styles from './RadioGroup.module.css';

export interface RadioOption {
  value   : string;
  label   : string;
  sublabel?: string;
}

interface RadioGroupProps {
  name    : string;
  options : RadioOption[];
  value   : string;
  onChange: (value: string) => void;
  label?  : string;
}

export function RadioGroup({ name, options, value, onChange, label }: RadioGroupProps) {
  return (
    <div className={styles.wrap}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.group}>
        {options.map(opt => (
          <label
            key       ={opt.value}
            className ={`${styles.option} ${value === opt.value ? styles.selected : ''}`}
            onClick   ={() => onChange(opt.value)}
          >
            <input
              type    ="radio"
              name    ={name}
              value   ={opt.value}
              checked ={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <div className={styles.text}>
              <div className={styles.optLabel}>{opt.label}</div>
              {opt.sublabel && <div className={styles.optSub}>{opt.sublabel}</div>}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
