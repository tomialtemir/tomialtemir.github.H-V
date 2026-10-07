(() => {
  function iniciar() {
    const form = document.getElementById('contactoForm');
    const aviso = document.getElementById('formAlert');
    const boton = document.getElementById('envio');
    if (!form || !aviso || !boton || form.dataset.hvInicializado) return;
    form.dataset.hvInicializado = 'true';
    boton.disabled = false;
    document.getElementById('hv-contacto-aviso')?.remove();
    boton.removeAttribute('aria-describedby');
    let enviando = false;
    const mostrar = (mensaje, error = false) => {
      aviso.textContent = mensaje;
      aviso.style.borderColor = error ? '#b42318' : '#0757bf';
      aviso.style.color = error ? '#b42318' : '#0757bf';
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (enviando || !form.reportValidity()) return;
      for (const nombre of ['nombre', 'correo', 'mensaje']) {
        if (!form.elements.namedItem(nombre).value.trim()) {
          mostrar('Completá todos los campos antes de enviar.', true);
          form.elements.namedItem(nombre).focus();
          return;
        }
      }
      enviando = true;
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      form.setAttribute('aria-busy', 'true');
      mostrar('Estamos enviando tu consulta.');
      try {
        const respuesta = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
          credentials: 'same-origin'
        });
        if (!respuesta.headers.get('content-type')?.includes('application/json')) {
          throw new Error('El servidor no devolvió una respuesta válida. Verificá la configuración del formulario.');
        }
        const datos = await respuesta.json();
        if (!respuesta.ok || datos.ok !== true) {
          throw new Error(typeof datos.message === 'string' ? datos.message : 'No se pudo enviar la consulta.');
        }
        mostrar(datos.message || 'Tu consulta fue enviada. ¡Gracias por escribirnos!');
        form.reset();
      } catch (error) {
        mostrar(error instanceof TypeError
          ? 'No pudimos confirmar el envío por un problema de conexión. Tus datos siguen en el formulario. Podés contactarnos por WhatsApp.'
          : error.message, true);
      } finally {
        enviando = false;
        boton.disabled = false;
        boton.textContent = 'Enviar consulta';
        form.removeAttribute('aria-busy');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
