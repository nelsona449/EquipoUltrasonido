// Variables para controlar el estado del dispositivo
let estadoDispositivo = localStorage.getItem("estadoDispositivo") || "apagado";
let tiempoRestante = parseInt(localStorage.getItem("tiempoRestante")) || 0;
let countdownInterval;
const tiempoLimite = 300; // Tiempo límite del equipo en funcionamiento

window.onload = () => {
  restaurarEstadoDispositivo();
  if (estadoDispositivo === "encendido" && tiempoRestante > 0) {
    console.log("Reanudando temporizador...");
    const elapsedTimeElement = document.getElementById("elapsed-time");
    elapsedTimeElement.style.display = "block";
    startCountdown(tiempoRestante);
  }
};

// Función para iniciar el temporizador de cuenta regresiva
function startCountdown(totalTiempo) {
  const elapsedTimeElement = document.getElementById("elapsed-time-value");
  let tiempoRestante = totalTiempo;

  // Guardar el tiempo total configurado en localStorage
  localStorage.setItem("tiempoRestante", tiempoRestante);
  console.log("El tiempo total configurado en localStorage:" + tiempoRestante);
  countdownInterval = setInterval(() => {
    if (tiempoRestante > 0) {
      tiempoRestante--;
      // Guardar el tiempo restante actualizado en localStorage
      localStorage.setItem("tiempoRestante", tiempoRestante);

      const minutos = Math.floor(tiempoRestante / 60);
      const segundos = tiempoRestante % 60;
      elapsedTimeElement.textContent = `${String(minutos).padStart(
        2,
        "0"
      )}:${String(segundos).padStart(2, "0")}`;
    } else {
      clearInterval(countdownInterval);
      // Eliminar el tiempo restante de localStorage al finalizar
      localStorage.removeItem("tiempoRestante");
      showAlert(
        "¡Fin del Tiempo!",
        "El dispositivo se apagó automáticamente.",
        "success"
      );
      apagarDispositivoAutomatico();
    }
  }, 1000);
}

// Función para restaurar el estado del dispositivo desde localStorage
function restaurarEstadoDispositivo() {
  cambiarEstadoDispositivo(estadoDispositivo); // Restaurar estado desde Local Storage
  console.log(`Estado restaurado: ${estadoDispositivo}`);

  const tiempoGuardado = parseInt(localStorage.getItem("tiempoRestante"));
  if (estadoDispositivo === "encendido" && tiempoGuardado > 0) {
    console.log(
      `Restaurando temporizador con ${tiempoGuardado} segundos restantes.`
    );
    startCountdown(tiempoGuardado); // Reinicia el temporizador
  }
}

// Función para cambiar el estado del dispositivo y guardar en localStorage
function cambiarEstadoDispositivo(estado) {
  estadoDispositivo = estado;
  localStorage.setItem("estadoDispositivo", estado); // Guardar el estado en Local Storage
  document.getElementById(
    "device-status"
  ).textContent = `Estado del dispositivo: ${
    estado.charAt(0).toUpperCase() + estado.slice(1)
  }`;
  document
    .getElementById("toggle-btn")
    .classList.toggle("on", estado === "encendido");
  document.getElementById("configure-btn").style.backgroundColor =
    estado === "encendido" ? "#4CAF50" : "#007BFF";
}

function updateFrequency(slider) {
  const value = parseInt(slider.value);
  const mappedValue = value <= 0 ? 0 : value <= 5 ? 28 : 40;
  slider.value = value;
  console.log(`Frecuencia: ${mappedValue} kHz`);
  document.getElementById("frequency-value").textContent = `${mappedValue} kHz`;
}

let configurarDeviceTimer; // Temporizador para advertencia

// Función de validación reutilizable
function validateInput(frecuencia, minutos, segundos) {
  if (!frecuencia || frecuencia === "0") {
    showAlert(
      "¡ERROR!",
      "Por favor, seleccione una frecuencia válida.",
      "error"
    );
    return false;
  }
  if (isNaN(minutos) || isNaN(segundos) || (minutos === 0 && segundos === 0)) {
    showAlert(
      "¡ERROR!",
      "Por favor, ingrese un tiempo válido en formato min:seg.",
      "error"
    );
    return false;
  }
  return true;
}

// Función para configurar el dispositivo
function configureDevice() {
  console.log("Configurando dispositivo...");
  if (estadoDispositivo === "encendido") {
    console.log(
      "El dispositivo ya está configurado y activo. No se reiniciará."
    );
    return; // Salir de la función si el dispositivo ya está encendido
  }
  const frecuencia = document.getElementById("frequency").value;
  const minutos = parseInt(document.getElementById("minutes").value || 0);
  const segundos = parseInt(document.getElementById("seconds").value || 0);

  if (!validateInput(frecuencia, minutos, segundos)) return;

  const recipienteLleno = document.getElementById("recipiente").checked;
  if (!recipienteLleno) {
    showAlert(
      "¡ADVERTENCIA!",
      "Por favor, asegúrese de llenar el recipiente con agua.",
      "warning"
    );
    return;
  }

  const totalTiempo = minutos * 60 + segundos;
  const tiempoNormalizadoMin = Math.floor(totalTiempo / 60);
  const tiempoNormalizadoSeg = totalTiempo % 60;

  if (totalTiempo <= 0) {
    showAlert("¡ERROR!", "El tiempo debe ser mayor que cero.", "error");
    return;
  }

  document.getElementById("minutes").value = tiempoNormalizadoMin;
  document.getElementById("seconds").value = tiempoNormalizadoSeg;

  const elapsedTimeElement = document.getElementById("elapsed-time");
  elapsedTimeElement.style.display = "block";

  document.getElementById("elapsed-time-value").textContent = `${String(
    tiempoNormalizadoMin
  ).padStart(2, "0")}:${String(tiempoNormalizadoSeg).padStart(2, "0")}`;

  if (countdownInterval) clearInterval(countdownInterval);
  if (configurarDeviceTimer) clearTimeout(configurarDeviceTimer);

  if (totalTiempo > tiempoLimite) {
    document.getElementById("elapsed-time").style.display = "none";
    cambiarEstadoDispositivo("apagado");
    showAlert(
      "Advertencia",
      "Si sobrepasa este tiempo, podría haber consecuencias con el equipo. ¿Desea continuar?",
      "warning",
      [
        {
          text: "Continuar",
          class: "alert-button-warning",
          onClick: () => {
            closeAlert();
            console.log("El usuario decidió continuar.");
            elapsedTimeElement.style.display = "block";
            iniciarConfiguracion(frecuencia, totalTiempo); // Continuar con la configuración
            cambiarEstadoDispositivo("encendido");
          },
        },
        {
          text: "Cancelar",
          class: "alert-button-default",
          onClick: () => {
            closeAlert();
            console.log("El usuario decidió Cancelar.");
          },
        },
      ]
    );
    return;
  }

  iniciarConfiguracion(frecuencia, totalTiempo);
  cambiarEstadoDispositivo("encendido");
}

function iniciarConfiguracion(frecuencia, totalTiempo) {
  console.log("Iniciando configuración del dispositivo...");
  startCountdown(totalTiempo);

  fetch("/192.168.4.1/configurar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frecuencia, tiempo: totalTiempo }),
  })
    .then((response) =>
      response.ok
        ? console.log("Dispositivo configurado correctamente")
        : showAlert("¡ERROR!", "Error al configurar los parámetros.", "error")
    )
    .catch((error) =>
      showAlert("¡ERROR!", `Error en la conexión: ${error}`, "error")
    );
}

// Restaurar el temporizador desde localStorage
function restaurarEstadoDispositivo() {
  cambiarEstadoDispositivo(estadoDispositivo);
  console.log(`Estado restaurado: ${estadoDispositivo}`);

  const endTime = parseInt(localStorage.getItem("endTime"));
  if (estadoDispositivo === "encendido" && endTime) {
    const tiempoRestante = Math.max(
      0,
      Math.floor((endTime - Date.now()) / 1000)
    );
    if (tiempoRestante > 0) {
      console.log(
        `Restaurando temporizador con ${tiempoRestante} segundos restantes.`
      );
      startCountdown(tiempoRestante);
    } else {
      console.log("El temporizador ya expiró.");
      localStorage.removeItem("endTime");
    }
  }
}

function apagarDispositivoAutomatico() {
  console.log("Apagando dispositivo automáticamente...");
  localStorage.removeItem("tiempoRestante"); // Limpia el tiempo restante
  cambiarEstadoDispositivo("apagado");
  apagarDispositivo();
}

function apagarDispositivoManual() {
  console.log("Intentando apagar dispositivo manualmente...");
  if (estadoDispositivo === "apagado") {
    console.log("El dispositivo ya está apagado. No se reiniciará.");
    return;
  }
  showAlert(
    "Confirmación",
    "¿Está seguro de que desea apagar el dispositivo?",
    "warning",
    [
      {
        text: "Apagar",
        class: "alert-button-warning",
        onClick: () => {
          closeAlert();
          localStorage.removeItem("tiempoRestante"); // Limpia el tiempo restante
          cambiarEstadoDispositivo("apagado");
          clearInterval(countdownInterval);
          apagarDispositivo();
        },
      },
      {
        text: "Cancelar",
        class: "alert-button-default",
        onClick: () => {
          closeAlert();
          console.log(
            "Cancelado el apagado. El temporizador sigue funcionando."
          );
        },
      },
    ]
  );
}

function cambiarEstadoDispositivo(estado) {
  estadoDispositivo = estado;
  localStorage.setItem("estadoDispositivo", estado); // Guardar el estado en Local Storage
  document.getElementById(
    "device-status"
  ).textContent = `Estado del dispositivo: ${
    estado.charAt(0).toUpperCase() + estado.slice(1)
  }`;
  document
    .getElementById("toggle-btn")
    .classList.toggle("on", estado === "encendido");
  document.getElementById("configure-btn").style.backgroundColor =
    estado === "encendido" ? "#4CAF50" : "#007BFF";
}

function apagarDispositivo() {
  fetch("/192.168.4.1/apagar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "apagado" }),
  })
    .then((response) =>
      response.ok
        ? console.log("El dispositivo se apagó correctamente.")
        : showAlert("¡ERROR!", "No se pudo apagar el dispositivo.", "error")
    )
    .catch((error) =>
      showAlert("¡ERROR!", `Error en la conexión al apagar: ${error}`, "error")
    );

  document.getElementById("elapsed-time").style.display = "none";
}

function showAlert(title, message, type = "success", buttons = []) {
  const alertTitle = document.getElementById("alert-title");
  const alertMessage = document.getElementById("alert-message");
  const alertContent = document.querySelector(".alert-content");
  const alertIcon = document.getElementById("alert-icon");
  const alertButtonsContainer = document.getElementById("alert-buttons");

  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertContent.className = `alert-content ${type}`;
  alertIcon.className = `alert-icon ${type}`;
  alertIcon.innerHTML = type === "success" ? "✔" : type === "error" ? "✖" : "⚠";

  alertButtonsContainer.innerHTML = "";

  if (buttons.length === 0) {
    buttons.push({
      text: "Aceptar",
      class: `alert-button-${type}`,
      onClick: closeAlert,
    });
  }

  buttons.forEach((button) => {
    const btn = document.createElement("button");
    btn.textContent = button.text;
    btn.className = button.class;
    btn.onclick = button.onClick;
    alertButtonsContainer.appendChild(btn);
  });

  document.getElementById("custom-alert").style.display = "flex";
}

function closeAlert() {
  document.getElementById("custom-alert").style.display = "none";
}
