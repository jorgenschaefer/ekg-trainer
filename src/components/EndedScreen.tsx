import Link from "next/link";
import styles from "./EndedScreen.module.css";

// Terminal screen — clearly distinct from the transient reconnect pill.
export default function EndedScreen() {
  return (
    <main className={styles.screen}>
      <div className={styles.box}>
        <h1 className={styles.title}>Sitzung nicht mehr aktiv</h1>
        <Link className={styles.link} href="/">
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}
