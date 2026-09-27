interface Props { ids: number[] }

export default function UsedChampions({ ids }: Props) {
  return (
    <section class="content-panel used-panel" aria-labelledby="used-heading">
      <h2 id="used-heading">Campeones utilizados</h2>
      <p>Bloqueados en esta serie</p>
      {ids.length ? <div class="used-id-grid">{ids.map((id) => <span key={id}>#{id}</span>)}</div>
        : <p>Todavía no se han bloqueado campeones.</p>}
      <p class="read-only-note">La creación de partidas se realiza desde la aplicación PersoBuilder.</p>
    </section>
  );
}
