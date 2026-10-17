import { useState } from "react";
import { Search } from "lucide-react";
import { adminHelpFaqs, filterAdminHelpFaqs } from "../lib/adminHelp";

export default function AdminHelpCenter() {
  const [query, setQuery] = useState("");
  const faqs = filterAdminHelpFaqs(query);

  return <section className="admin-panel admin-help-center" aria-label="Admin help center">
    <p className="admin-data-caption">Guidance for the tools and workflows available in this dashboard.</p>
    <label className="admin-help-search">
      <Search size={17} aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search help topics..."
        aria-label="Search help topics"
      />
    </label>
    {faqs.length ? <div className="admin-help-faqs">
      {faqs.map(({ id, question, answer }) => <details className="admin-help-faq" key={id}>
        <summary>{question}</summary>
        <p>{answer}</p>
      </details>)}
    </div> : <p className="admin-help-empty" role="status">No help topics match “{query.trim()}”. Try another search.</p>}
    {!query && <p className="admin-data-caption">{adminHelpFaqs.length} topics</p>}
  </section>;
}
