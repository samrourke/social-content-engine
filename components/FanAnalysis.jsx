import styles from "./FanAnalysis.module.css";

// Below this many fans, shares swing wildly with each extra fan, so flag it
const SMALL_SAMPLE = 30;

function formatPercent(share) {
  return `${Math.round(share * 100)}%`;
}

function formatNumber(value) {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-GB");
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Horizontal bars: one row per item, bar length = share of fans
function ShareBars({ title, description, rows, limit = 10 }) {
  if (!rows?.length) return null;

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {description && <p className={styles.panelDescription}>{description}</p>}

      <ol className={styles.bars}>
        {rows.slice(0, limit).map((row) => (
          <li
            key={row.name}
            className={styles.barRow}
            title={`${capitalise(row.name)}: ${row.fans} fans (${formatPercent(row.share)})`}
          >
            <span className={styles.barLabel}>{capitalise(row.name)}</span>
            <span className={styles.barTrack}>
              <span
                className={styles.barFill}
                style={{ width: `${Math.max(row.share * 100, 1)}%` }}
              />
            </span>
            <span className={styles.barValue}>
              {formatPercent(row.share)}
              <em>{row.fans} fans</em>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AccountsByCategory({ accountsByCategory }) {
  const categories = Object.entries(accountsByCategory ?? {});
  if (categories.length === 0) return null;

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Most-followed accounts by category</h2>
      <p className={styles.panelDescription}>
        Share of analysed fans who follow each account.
      </p>

      <div className={styles.categoryGrid}>
        {categories.map(([category, accounts]) => (
          <div key={category} className={styles.categoryCard}>
            <h3 className={styles.categoryTitle}>{capitalise(category)}</h3>
            <ol className={styles.accountList}>
              {accounts.map((account) => (
                <li key={account.username} className={styles.accountRow}>
                  <span className={styles.accountName}>
                    <a
                      href={`https://www.instagram.com/${account.username}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {account.full_name?.trim() || `@${account.username}`}
                    </a>
                    <em>
                      {[account.subcategory, account.team].filter(Boolean).join(" · ")}
                    </em>
                  </span>
                  <span className={styles.accountShare}>{formatPercent(account.share)}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FanAnalysis({ engagement, summary }) {
  if (!engagement && !summary) {
    return (
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <h1 className={styles.title}>Fan analysis</h1>
          <p className={styles.subtitle}>
            No analysis files found. Run the scripts in scripts/fanAnalysis/ locally —
            results are read from output/fan-analysis/ and aren&apos;t deployed.
          </p>
        </header>
      </div>
    );
  }

  const smallSample = summary && summary.fansAnalysed < SMALL_SAMPLE;

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Fan analysis</h1>
        {engagement && (
          <p className={styles.subtitle}>
            Instagram · last {engagement.postCount} posts ({formatDate(engagement.firstPostDate)} –{" "}
            {formatDate(engagement.lastPostDate)}) · scraped {formatDate(engagement.scrapedAt)}
          </p>
        )}
      </header>

      {engagement && (
        <section>
          <h2 className={styles.sectionHeading}>Engaged audience</h2>
          <dl className={styles.tiles}>
            <div className={styles.tile}>
              <dt>Fans who engaged</dt>
              <dd>{formatNumber(engagement.totalFans)}</dd>
              <em>liked or commented</em>
            </div>
            <div className={styles.tile}>
              <dt>Repeat fans</dt>
              <dd>{formatNumber(engagement.repeatFans)}</dd>
              <em>{formatPercent(engagement.repeatFans / engagement.totalFans)} engaged with 2+ posts</em>
            </div>
            <div className={styles.tile}>
              <dt>Superfans</dt>
              <dd>{formatNumber(engagement.superfans)}</dd>
              <em>engaged with all {engagement.postCount} posts</em>
            </div>
            <div className={styles.tile}>
              <dt>Private accounts</dt>
              <dd>{formatPercent(engagement.privateFans / engagement.totalFans)}</dd>
              <em>{formatNumber(engagement.privateFans)} fans can&apos;t be profiled</em>
            </div>
          </dl>
        </section>
      )}

      {summary && (
        <section>
          <h2 className={styles.sectionHeading}>What engaged fans follow</h2>
          <p className={styles.sectionNote}>
            Based on {formatNumber(summary.fansAnalysed)} public repeat fans
            {engagement ? ` (of ${formatNumber(engagement.eligibleFans)} eligible)` : ""} and the{" "}
            {formatNumber(summary.accountsCategorised)} accounts several of them follow. Shares
            are the percentage of those fans who follow at least one account of each kind.
          </p>

          {smallSample && (
            <p className={styles.warning}>
              Test sample: only {summary.fansAnalysed} fans analysed, so these percentages
              aren&apos;t meaningful yet.
            </p>
          )}

          <div className={styles.chartGrid}>
            <ShareBars title="Categories" rows={summary.categories} />
            <ShareBars title="Interests" rows={summary.subcategories} />
            <ShareBars
              title="Teams"
              description="Teams of followed sports accounts. Players' teams come from the model's knowledge and may be out of date."
              rows={summary.teams}
            />
          </div>

          <AccountsByCategory accountsByCategory={summary.accountsByCategory} />
        </section>
      )}
    </div>
  );
}
