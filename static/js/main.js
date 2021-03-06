(function () {
	'use strict';


	var editor_tmpl;
	var element_tmpl;
	var entry_tmpl;

	const DB_URL = 'https://fiery-heat-9174.firebaseio.com';

	const login_button = '<span class="glyphicon glyphicon-log-in" aria-hidden="true">';
	const logout_button = '<span class="glyphicon glyphicon-log-out" aria-hidden="true">';

	var fb;
	var fb_user; 
	var auth;

	var guuid = function(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	};

	var store = function(id, date, content){
		if (!fb_user){
			localStorage.setItem("id::" + id, JSON.stringify({"date": date, "content": content}));
		} else {
			fb_user.child(id).set(
				{"date": date, "content": content},
				function(error){
					if (error){
						console.error("could not store entry");
					}
				}
				);
		}
	};

	var remove = function(id){
		if (!fb_user){
			localStorage.removeItem("id::" + id);
		} else {
			fb_user.child(id).remove();
		}
	};

	var fill_source = function(id){
		if (!fb_user){
			var entry = JSON.parse(localStorage.getItem("id::" + id));
			$("#editor").focus().val(entry.content);
		} else {
			fb_user.child(id).once("value", function(snapshot){
				var entry = snapshot.val();
				$("#editor").focus().val(entry.content);
			});
		}
	};

	var replace_with_entry = function(dom,id){
		if (!fb_user){
			var entry = JSON.parse(localStorage.getItem("id::" + id));
			dom.replaceWith(Mustache.render(
				entry_tmpl,
				{date: entry.date.slice(0,10), content: marked(entry.content)}
				));
		} else {
			fb_user.child(id).once("value", function(snapshot){
				var entry = snapshot.val();
				dom.replaceWith(Mustache.render(
					entry_tmpl,
					{date: entry.date.slice(0,10), content: marked(entry.content)}
					));
			});
		}
	};

	var add_entry = function(id, content, date){
		if ($("#" + id).length === 0){
			$("#elements-container").prepend(Mustache.render(
				element_tmpl,
				{content: marked(content), date: date.slice(0,10), id: id},
				{inner: entry_tmpl}
				));
		}
	};

	var mark_entry_synced = function (id) {
		var header = $("#" + id + " .header");
		if (header.find(".synced").length===0){
			header.append(' <span class="synced glyphicon glyphicon-saved" aria-hidden="true">');
		} else {
			console.warn("double sync attempt");
		}
	}

	var initialize = function(authData){
		// Initialize Firebase
		fb_user = firebase.database().ref("users/" + authData.uid + "/entries");

		fb_user.orderByChild("date").on('child_added', function(snapshot) {
			var entry = snapshot.val();
			add_entry(snapshot.key, entry.content, entry.date);
			mark_entry_synced(snapshot.key);
		});

		fb_user.on('child_changed', function(snapshot) {
			mark_entry_synced(snapshot.key);
		});

		for (var i = 0; i < localStorage.length; i++){
			var key = localStorage.key(i);
			if (key.startsWith("id::")){
				var entry = JSON.parse(localStorage.getItem(key));
				store(key.slice(4), entry.date, entry.content);
				localStorage.removeItem(key);
			}
		}
	};


	jQuery.fn.extend({
		markify: function(date, content){
			if (content === undefined){
				content = $(this).val();
			}
			if (date === undefined){
				date = new Date().toISOString();
			}
			var entry_id = $(this).parent().parent().attr("id");
			if ($.trim(content)!==""){
				$(this).replaceWith(Mustache.render(
					entry_tmpl,
					{date: date.slice(0,10),content: marked(content)}
					));
				store(entry_id, date, content);
			} else {
				$(this).parent().parent().remove();
				remove(entry_id);
			}
			$("#plus-button").focus();
		}
	});


	$(document).ready(function(){
		editor_tmpl = $('#editor-template').html();
		element_tmpl = $('#element-template').html();
		entry_tmpl = $('#entry-template').html();
		Mustache.parse(editor_tmpl);
		Mustache.parse(element_tmpl);
		Mustache.parse(entry_tmpl);

		// Initialize Firebase
		var config = {
			apiKey: "AIzaSyB7j0dvSeJT85qPU0PM6RY55clGRXPhvyk",
			authDomain: "fiery-heat-9174.firebaseapp.com",
			databaseURL: "https://fiery-heat-9174.firebaseio.com",
			storageBucket: "fiery-heat-9174.appspot.com",
		};
		firebase.initializeApp(config);

		fb = firebase.database().ref();
		auth = firebase.auth();

		$("#plus-button").focus();

		auth.onAuthStateChanged(function(authData){
			if (authData === null) {
				console.log("we don't know any user yet");
			// configure button to open modal for login/signup
			$("#login-button").html(login_button).off( "click" ).click(function(){
				$('#conf-modal').modal();
				$("#errordisplay").hide();
				return false;
			});
			

			for (var i = 0; i < localStorage.length; i++){
				var key = localStorage.key(i);
				if (key.startsWith("id::")){
					var id = key.slice(4); 
					var entry = JSON.parse(localStorage.getItem(key));
					add_entry(id, entry.content, entry.date);
				}
			}
			
		} else {
			$("#login-button").html(logout_button).off( "click" ).click(function(){
				auth.signOut();
				$("#elements-container").children().remove();
				fb_user = null;
				return false;
			});
			initialize(authData);
		}
	});

		$("#help-button").click(function(){
			$('#help-modal').modal();
			return false;
		});

		$("#list-button").click(function(){
			$(".entry").each(function(){
				if ($(this).find(".teaser").length === 0){
					$(this).html("<h5 class='teaser'>" 
						+ $(this).children(".date").text() 
						+ ": " 
						+ $(this).children(".content").children(':first-child').text().slice(0,20) 
						+ "</h5>");
				}
			});
			return false;
		});

		$("body").on("click", ".teaser", function(){
			var teaser = $(this);
			var id = teaser.parents(".row").attr("id");
			replace_with_entry(teaser.parent(), id);

		});


		$("#signupbutton").click(function(){
			auth.createUserWithEmailAndPassword($("#emailinput").val(), $("#passwordinput").val()).then(function(result){
				$("#wait-login").remove();
				alert("User creation successful, please login.");
				$('#conf-modal').modal("hide");
			}).catch(function(error){
				$("#wait-login").remove();
				$("#errordisplay").show().children("div").text(error);
			});
			
			$(this).after("<img class='loader-pic' id='wait-login' src='static/pics/ajax-loader.gif'></img>");
			
			return false;

		});

		$("#loginbutton").click(function(){
			auth.signInWithEmailAndPassword($("#emailinput").val(), $("#passwordinput").val()).then(function(result){
				//login successfull	
				$("#wait-login").remove();
				$('#conf-modal').modal("hide");
			}).catch(function(error) {
				$("#wait-login").remove();
				$("#errordisplay").show().children("div").text(error);
				
			});
			$(this).next().after("<img class='loader-pic' id='wait-login' src='static/pics/ajax-loader.gif'></img>");
			return false;
		});



		$("#plus-button").click(function(){

			$("#elements-container").prepend(
				Mustache.render(element_tmpl,{id: guuid()},{inner: editor_tmpl})
				);
			$("#editor").focus();
			return false;
		});

		$("body").on("dblclick tab", ".entry", function(){
			var entry_id = $(this).parent().parent().attr("id");
			$(this).replaceWith(Mustache.render(editor_tmpl));
			fill_source(entry_id);
		});


		$("body").on('focusout','#editor', function(){
			$(this).markify();
		});

		(function() {
			var cnt_enter = 0;
			$("body").on('change keyup paste',"#editor", function(e) {

				if (e.keyCode == 13){
					cnt_enter++;
				} else {
					cnt_enter = 0;
				}
				if (e.keyCode == 27 || cnt_enter == 3) {
				$(this).blur(); //triggers focusout
			}
		});
		})();

	});
}());