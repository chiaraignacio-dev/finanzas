import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title   : string;
  subtitle?: string;
  right?  : React.ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <div className={styles.sub}>{subtitle}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
