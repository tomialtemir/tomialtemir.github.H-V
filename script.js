(() => {
  // FORMULARIO DE CONTACTO
  function iniciarFormulario() {
    const form = document.getElementById("contactoForm");
    const aviso = document.getElementById("formAlert");
    const boton = document.getElementById("envio");

    if (!form || !aviso || !boton || form.dataset.hvInicializado) return;

    form.dataset.hvInicializado = "true";
    boton.disabled = false;

    let enviando = false;

    function mostrar(mensaje, error = false) {
      aviso.textContent = mensaje;
      aviso.style.borderColor = error ? "#b42318" : "#0757bf";
      aviso.style.color = error ? "#b42318" : "#0757bf";
    }

    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      if (enviando || !form.reportValidity()) return;

      for (const nombre of ["nombre", "correo", "mensaje"]) {
        const campo = form.elements.namedItem(nombre);

        if (!campo.value.trim()) {
          mostrar("Completá todos los campos antes de enviar.", true);
          campo.focus();
          return;
        }
      }

      enviando = true;
      boton.disabled = true;
      boton.textContent = "Enviando…";
      form.setAttribute("aria-busy", "true");

      mostrar("Estamos enviando tu consulta.");

      try {
        const respuesta = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });

        if (
          !respuesta.headers.get("content-type")?.includes("application/json")
        ) {
          throw new Error(
            "El servidor no devolvió una respuesta válida. Verificá la configuración del formulario."
          );
        }

        const datos = await respuesta.json();

        if (!respuesta.ok || datos?.ok !== true) {
          throw new Error(
            typeof datos?.message === "string"
              ? datos.message
              : "No se pudo enviar la consulta."
          );
        }

        mostrar(
          datos.message || "Tu consulta fue enviada. ¡Gracias por escribirnos!"
        );

        form.reset();
      } catch (error) {
        mostrar(
          error instanceof TypeError
            ? "No pudimos confirmar el envío por un problema de conexión. Tus datos siguen en el formulario. Podés contactarnos por WhatsApp."
            : error.message,
          true
        );
      } finally {
        enviando = false;
        boton.disabled = false;
        boton.textContent = "Enviar consulta";
        form.removeAttribute("aria-busy");
      }
    });
  }

  // FLECHA PARA VOLVER ARRIBA DE TODO
  function iniciarFlecha() {
    const nav = document.querySelector(".navegacion");
    const flecha = document.querySelector(".volver-arriba");

    if (!nav || !flecha || flecha.dataset.inicializada) return;

    flecha.dataset.inicializada = "true";
    flecha.setAttribute("aria-label", "Volver al inicio de la página");

    function actualizarVisibilidad() {
      // Solo aparece cuando el menú desaparece por arriba.
      flecha.hidden = nav.getBoundingClientRect().bottom > 0;
    }

    // Agrupa las actualizaciones durante el desplazamiento.
    let actualizacionPendiente = false;

    function solicitarActualizacion() {
      if (actualizacionPendiente) return;

      actualizacionPendiente = true;

      window.requestAnimationFrame(() => {
        actualizarVisibilidad();
        actualizacionPendiente = false;
      });
    }

    window.addEventListener("scroll", solicitarActualizacion, {
      passive: true,
    });

    window.addEventListener("resize", solicitarActualizacion);
    window.addEventListener("load", solicitarActualizacion);
    window.addEventListener("pageshow", solicitarActualizacion);

    // Detecta cambios de altura por imágenes o textos.
    if ("ResizeObserver" in window) {
      const observador = new ResizeObserver(solicitarActualizacion);
      observador.observe(document.body);
    }

    actualizarVisibilidad();

    flecha.addEventListener("click", (evento) => {
      evento.preventDefault();

      const reducirMovimiento = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      document.querySelector(".marca")?.focus({
        preventScroll: true,
      });

      window.scrollTo({
        top: 0,
        behavior: reducirMovimiento ? "instant" : "smooth",
      });
    });
  }

  function iniciar() {
    iniciarFormulario();
    iniciarFlecha();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();