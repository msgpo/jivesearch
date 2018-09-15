$(document).ready(function() {
  // highlight query in the results
  // Highlighting here ensures we don't introduce unsafe characters.
  // This is not ideal and should be replaced with a template 
  // function in Go as this will break if javascript is disabled.
  $(".description").each(function(index, value){
    var q = $("#query").data("query").split(" ");
    var content = $(value).html();
    var c = content.split(" ");
    for (var i = 0; i < c.length; i++){
      for (var j = 0; j < q.length; j++){
        if (c[i].toLowerCase().indexOf(q[j].toLowerCase()) != -1){
          c[i] = "<em>" + c[i] + "</em>";
        }
      }
    }
    $(value).html(c.join(" "));
  });

  // redirect to a default !bang
  $(document).on('click', '.bang_submit', function(){
    changeParamAndRedirect("q", $(this).data('location'));
  });

  // voting
  // TODO: HMAC key
  $(document).on('click', '.arrow', function(){
    var t = $(this);
    var v = $(t).data('vote');
    var removing = false;

    if ($(t).hasClass('voted')){ // already vote for that link?
      removing = true;
      $(t).removeClass('voted');
      v = -1*v;      
    }

    d = {
      'q': $('#query').data('query'), 
      'u': $(t).parent('.vote').data('url'), 
      'v': v
    };
    
    $.ajax({
      type: "POST",
      dataType: "json",
      url: "/vote",
      data: d
    }).done(function(data) {
      $(t).siblings('.arrow').removeClass('voted'); // remove prior vote if it is different
      if (removing != true){
        $(t).addClass('voted');
      }
    }).fail(function(data) {
      $(t).siblings('.arrow').removeClass('voted');
    });
  });

  // Traditional Pagination
  $(document).on('click', '.pagination', function(){
    changeParamAndRedirect("p", $(this).data('page')); 
  });

  function isBang(item) {
    return item.hasOwnProperty("trigger");
  }

  function label(item){
    var label = item.label;
    if (isBang(item)){
      label = "!" + item.trigger;
    }
    return label
  }

  // autocomplete
  $(function(){
    $("#query").autocomplete({
      delay: 25,
      minLength: 1,
      messages: {
        noResults: "",
        results: function() {}
      },
      open: function() {
        $("ul.ui-menu").innerWidth($(this).innerWidth()); // width of input including button
      },
      source: function(request, callback){
        $.getJSON('/autocomplete', {q: request.term}, function(data){ // '{q: request.term}' changes it from ?term=b to ?q=b so nginx doesn't log query.
          callback(data.suggestions);
        });
      },
      select: function(event, ui){
        if (!isBang(ui.item)){ 
          $("#query").val(label(ui.item));
          document.getElementById('form').submit();
          return false;
        }

        // don't submit bang if they aren't done w/ query
        $("#query").val(label(ui.item) + " ");
        return false;
      },
      focus: function(event, ui) {
        $("#query").val(label(ui.item));
        return false;
      },
      }).data('ui-autocomplete')._renderItem = function(ul, item){
        var label = item.label;
        var bang = isBang(item);
        
        if (bang===true){
          label = item.trigger;
        }
        
        // highlight matches in the dropdown
        var re = new RegExp(this.term, 'i');
        var re = new RegExp("^" + this.term);
        var r = label.replace(re, "<span style='font-weight:normal;'>" + "$&" + "</span>");
        var formatted = "<a>" + r + "</a>";

        if (bang===true){
          // Note: below about 600px this doesn't display right.
          // I've tried adding "display:none" for the bang name in main.css but that isn't being respected for some reason.
          r = '<span style="vertical-align:top;">' + item.name + '</span><span style="float:right;margin-right:40%;margin-left:1px;"> !' + r + '</span>';
          formatted = '<a><img width="20" height="20" style="vertical-align:top;" src="' + item.favicon + '"/> ' + r + '</a>';
        }

        return $("<li></li>").data("item.autocomplete", item).append(formatted).appendTo(ul);
      };
  });

  // fix the size of the autocomplete dropdown menu to match the size of the input
  jQuery.ui.autocomplete.prototype._resizeMenu = function(){
    var ul = this.menu.element;
    ul.outerWidth($("#query").outerWidth(true)-40); // 40 is the width of our button
  }

  // redirect "did you mean?" queries
  $("#alternative").on("click", function(){  
    changeParamAndRedirect("q", $(this).attr("data-alternative"));  
  });

  function queryString(){
    return window.location.search;
  }

  $("#safesearch").show();
  $("#safesearchbtn").on("click", function(){
    $("#safesearch-content").toggle();
  });

  $("#safe").on("click", function(){
    var checked = $("#safe").is(':checked') ? "" : "f";
    changeParamAndRedirect("safe", checked);
  });

  $("#all").on("click", function(){
    // we should delete the param but this works also 
    changeParamAndRedirect("t", "");
  });

  $("#images").on("click", function(){
    changeParamAndRedirect("t", "images");
  });

  $("#map, #maps").on("click", function(){
    changeParamAndRedirect("t", "maps");
  });

  var b = browser();
  $("#add_me").html("Add "+brand+" to " + b);

  $("#add_to_browser").on("click", function(){
    $("#about_us").toggle();
    $("#instructions").toggle();
    if (b === "Brave" || b === "Chrome" || b === "Chromium" || b === "Iridium" || b === "Opera"){
      $("#chrome_instructions").show(); // Brave's new release will be same as Chrome for setting search engine???
    } else if (b==="Vivaldi"){
      $("#vivaldi_instructions").show(); 
    } else if (b==="Edge"){
      $("#edge_instructions").show();
    } else if (b==="Firefox" || b==="Cyberfox" || b==="PaleMoon"){
      $("#firefox_instructions").show();      
    } else if (b==="Safari"){
      $("#safari_instructions").show();      
    }
  });

  // Firefox add-on
  $("#load_ff_addon").on("click", function(){
    if (window.external && ("AddSearchProvider" in window.external)) {
      // Firefox 2 and IE 7, OpenSearch
      window.external.AddSearchProvider("/opensearch.xml");
    } else if (window.sidebar && ("addSearchEngine" in window.sidebar)) {
      // TODO: Firefox <= 1.5, Sherlock
      // window.sidebar.addSearchEngine("/search-plugin.src", "/search-icon.png", "Search Plugin", "");
    } else {
      // No search engine support (IE 6, Opera, etc).
      alert("No search engine support");
    }
  });
});

// Browser detection for instructions to set your search engine
// https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser/9851769
var browser = function() {
  // Return cached result if avalible, else get result then cache it.
  if (browser.prototype._cachedResult)
      return browser.prototype._cachedResult;
  // Opera 8.0+
  var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
  // Firefox 1.0+
  var firefox = typeof InstallTrigger !== 'undefined';
  var isFirefox = false;
  var isPaleMoon = false;
  var isCyberfox = false;
  if (firefox){
    // what flavor??? (Can't identify Waterfox???)
    if (navigator.userAgent.includes("PaleMoon")){ // better way to detect???
      isPaleMoon = true;
    } else if (navigator.userAgent.includes("Cyberfox")){ // better way to detect???
      isCyberfox = true;
    } else {
      isFirefox = true;
    }
  }
  
  // Safari 3.0+ "[object HTMLElementConstructor]" 
  var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification);
  // Internet Explorer 6-11
  var isIE = /*@cc_on!@*/false || !!document.documentMode;
  // Brave
  var isBrave = false;
  // Iridium
  var isIridium = false;
  // Vivaldi
  var isVivaldi = false;
  // Edge 20+
  var isEdge = !isIE && !!window.StyleMedia;
  // Chrome 1+, Chromium, etc.
  var chrome = !!window.chrome && !!window.chrome.webstore;
  var isChrome = false;
  var isChromium = false;
  if (chrome){ // what flavor of Chrome???
    if (chromium()){ 
      if (navigator.userAgent.includes("Iridium")){ // better way to detect Iridium???
        isIridium = true;
      } else if (/Vivaldi\/\d*\.?\d*/g.test(navigator.userAgent)){
        isVivaldi = true;
      } else {
        isChromium = true;
      }
    } else if (brave()){
      isBrave = true;
    } else{
      isChrome = true;
    }
  }
  // Blink engine detection
  var isBlink = (isChrome || isOpera) && !!window.CSS;

  return browser.prototype._cachedResult =
      isOpera ? 'Opera' :
      isFirefox ? 'Firefox' :
      isPaleMoon ? 'PaleMoon' :
      isCyberfox ? 'Cyberfox' :
      isSafari ? 'Safari' :
      isChrome ? 'Chrome' :
      isChromium ? 'Chromium' :
      isVivaldi ? 'Vivaldi' :
      isIE ? 'Internet Explorer' :
      isBrave ? 'Brave' :
      isIridium ? 'Iridium' :
      isEdge ? 'Edge' :
      isBlink ? 'Blink' :
      'Chrome'; // give them Chrome instructions...better than nothing????
};

function chromium(){ 
  for (var i = 0, u="Chromium", l =u.length; i < navigator.plugins.length; i++){
    if (navigator.plugins[i].name != null && navigator.plugins[i].name.substr(0, l) === u){
      return true;
    }
  }
  return false;
}

function brave() {
  // initial assertions
  if (!window.google_onload_fired &&
       navigator.userAgent &&
      !navigator.userAgent.includes('Chrome'))
    return false;

  // set up test
  var test = document.createElement('iframe');
  test.style.display = 'none';
  document.body.appendChild(test);

  // empty frames only have this attribute set in Brave Shield
  var is_brave = (test.contentWindow.google_onload_fired === true);

  // teardown test
  test.parentNode.removeChild(test);

  return is_brave;
}