// interface InformePanelProps {
//   datosZona: any | null;
// }

// export default function InformePanel({ datosZona }: InformePanelProps) {
//   if (!datosZona) return null;

//   return (
//     <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-lg p-4 overflow-y-auto z-50">
//       <h2 className="font-bold text-lg mb-2">Informe de la Zona</h2>

//       {/* Coordenadas */}
//       <p>📍 Lat: {datosZona.lat.toFixed(6)}</p>
//       <p>📍 Lon: {datosZona.lon.toFixed(6)}</p>

//       {/* Urbanismo */}
//       <h3 className="mt-4 font-semibold">Urbanismo</h3>
//       <p>Edificios Cercanos: {datosZona.urbanismo.edificiosCercanos.join(', ')}</p>
//       <p>Parques: {datosZona.urbanismo.parques.join(', ')}</p>
//       <p>Uso de Suelo: {datosZona.urbanismo.usoSuelo}</p>

//       {/* Riesgo de Inundación */}
//       <h3 className="mt-4 font-semibold">Riesgo de Inundación</h3>
//       <p>Nivel: {datosZona.riesgo.nivel}</p>
//       <p>Comentarios: {datosZona.riesgo.comentarios}</p>
//     </div>
//   );
// }
