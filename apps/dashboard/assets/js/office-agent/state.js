/* Office Agent — store kecil untuk satu sesi layar.
 *
 * Bukan framework: satu objek, satu daftar pelanggan, satu notifikasi. Layar
 * berlangganan dan menggambar ulang dirinya sendiri; tidak ada render implisit
 * yang bisa membuat status persetujuan dan status eksekusi tercampur.
 */
(function () {
  'use strict';

  function base() {
    return {
      stage: 1,
      maxStage: 1,
      mode: 'probing',
      reason: null,
      probe: null,
      request: null,
      summary: null,
      actions: [],
      clarifications: [],
      answers: {},
      plan: null,
      planId: null,
      approval: null,
      approvals: [],
      executions: [],
      audit: [],
      status: 'DRAFT',
      loading: false,
      error: null,
      planChanged: false
    };
  }

  window.DEXTRA_OFFICE_STATE = {
    create: function () {
      var state = base();
      var subscribers = [];

      function notify() {
        subscribers.slice().forEach(function (fn) {
          try { fn(api.get()); } catch (e) { /* satu pelanggan gagal tidak boleh menghentikan layar */ }
        });
      }

      var api = {
        get: function () {
          return {
            stage: state.stage,
            maxStage: state.maxStage,
            mode: state.mode,
            reason: state.reason,
            probe: state.probe,
            request: state.request,
            summary: state.summary,
            actions: state.actions,
            clarifications: state.clarifications,
            answers: state.answers,
            plan: state.plan,
            planId: state.planId,
            approval: state.approval,
            approvals: state.approvals,
            executions: state.executions,
            audit: state.audit,
            status: state.status,
            loading: state.loading,
            error: state.error,
            planChanged: state.planChanged
          };
        },

        set: function (patch) {
          Object.keys(patch || {}).forEach(function (k) {
            if (k in state) state[k] = patch[k];
          });
          notify();
        },

        /* Snapshot mesin demo sudah memakai nama field yang sama; hanya field
           yang boleh tampil di layar yang disalin. */
        replace: function (snapshot) {
          if (!snapshot) return;
          [
            'stage', 'maxStage', 'request', 'summary', 'actions', 'clarifications',
            'answers', 'plan', 'planId', 'approval', 'approvals', 'executions', 'audit',
            'status', 'planChanged', 'reason'
          ].forEach(function (k) {
            if (snapshot[k] !== undefined) state[k] = snapshot[k];
          });
          notify();
        },

        subscribe: function (fn) {
          subscribers.push(fn);
          return function () {
            subscribers = subscribers.filter(function (s) { return s !== fn; });
          };
        },

        notify: notify,

        reset: function () {
          state = base();
          notify();
        }
      };

      return api;
    }
  };
})();
