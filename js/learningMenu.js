/* Only expand/collapse navigation; never read or write learning records. */
(function(){
  'use strict';
  function close(button){
    const panel=document.getElementById(button.getAttribute('aria-controls'));
    button.setAttribute('aria-expanded','false');
    if(panel)panel.hidden=true;
  }
  function toggle(button){
    const menu=button.closest('.po-learning-menu');
    const panel=document.getElementById(button.getAttribute('aria-controls'));
    if(!menu||!panel)return;
    const open=button.getAttribute('aria-expanded')!=='true';
    menu.querySelectorAll('.po-step-expand').forEach(close);
    if(open){button.setAttribute('aria-expanded','true');panel.hidden=false;}
  }
  document.addEventListener('click',event=>{
    const action=event.target.closest?.('.po-step-primary,.po-step-options button,.po-quick-grid button');
    if(!action)return;
    action.closest('.po-learning-menu')?.querySelectorAll('.po-step-expand').forEach(close);
  },true);
  window.PowerOnMenu={toggle};
})();
