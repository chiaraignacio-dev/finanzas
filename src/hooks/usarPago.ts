import { useState } from 'react';

// ── Hook que centraliza el estado del flujo de pago inline ──
// Elimina la duplicación de pagando/montoPago en PagarDeudas
export function usarPago() {
  const [idPagando,  setIdPagando]  = useState<string | null>(null);
  const [montoPago,  setMontoPago]  = useState('');

  function iniciarPago(id: string) {
    setIdPagando(id);
    setMontoPago('');
  }

  function cancelarPago() {
    setIdPagando(null);
    setMontoPago('');
  }

  function estaPagando(id: string) {
    return idPagando === id;
  }

  return {
    idPagando,
    montoPago,
    setMontoPago,
    iniciarPago,
    cancelarPago,
    estaPagando,
  };
}
