document.addEventListener('DOMContentLoaded', function () {
  var tabBtns = document.querySelectorAll('.tab-btn');
  var loginCards = document.querySelectorAll('.login-card');

  // Varsayilan aktif sekme URL parametrelerinden
  const params = new URLSearchParams(window.location.search);
  const initialTab = params.get('tab');
  if (initialTab === 'user') {
    tabBtns.forEach(function(b){ if(b.dataset.tab==='user'){ b.classList.add('active'); } else { b.classList.remove('active'); }});
    loginCards.forEach(function(card){ card.classList.remove('active'); if(card.id==='userTab'){ card.classList.add('active'); }});
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetTab = this.dataset.tab;

      tabBtns.forEach(function (b) {
        b.classList.remove('active');
      });
      this.classList.add('active');

      loginCards.forEach(function (card) {
        card.classList.remove('active');
        if (card.id === targetTab + 'Tab') {
          card.classList.add('active');
        }
      });
    });
  });

  var togglePassword = document.getElementById('togglePassword');
  var passwordInput = document.querySelector('input[name="password"]');
  var passwordIcon = document.getElementById('passwordIcon');

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function () {
      var type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      if (passwordIcon) {
        passwordIcon.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
      }
    });
  }

  var toggleUserPassword = document.getElementById('toggleUserPassword');
  var userPasswordInput = document.getElementById('userPassword');

  if (toggleUserPassword && userPasswordInput) {
    toggleUserPassword.addEventListener('click', function () {
      var type = userPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      userPasswordInput.setAttribute('type', type);
      var icon = this.querySelector('i');
      if (icon) {
        icon.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
      }
    });
  }

  var loginForms = document.querySelectorAll('form.login-form');

  loginForms.forEach(function (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) {
        btn.disabled = true;
        var originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Giris Yapiliyor...';

        window.setTimeout(function () {
          if (btn.disabled) {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }
        }, 3000);
      }
    });
  });

  var emailInputs = document.querySelectorAll('input[type="email"]');
  emailInputs.forEach(function (input) {
    input.addEventListener('blur', function () {
      var emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (this.value && !emailRegex.test(this.value)) {
        this.classList.add('is-invalid');
      } else {
        this.classList.remove('is-invalid');
      }
    });
  });
});
